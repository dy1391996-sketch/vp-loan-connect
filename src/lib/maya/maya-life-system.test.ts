import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { MayaBrain } from "./brain";
import { createMockMayaProvider, createOpenAIProvider } from "./providers";
import { violatesPersonality } from "./providers/mock";
import { InMemoryMayaStore, newId, nowIso } from "./store";
import { defaultRelationshipState } from "./state";
import { retrieveRelevantContext } from "./retrieval";
import { correctMemory, forgetMemory } from "./correction";
import { consolidateOwnerMemory } from "./consolidation";
import { backupStore, exportOwnerArchive, importSeed, restoreBackup } from "./io";
import { handleInstagramMessage } from "./channels/instagram";
import { resetMayaEnvCacheForTests } from "./env";
import { ensureMasterVisualAsset, MASTER_MAYA_RELATIVE_PATH, registerVisualGeneration } from "./visual";
import { isTransientSmallTalk, classifyProvenance, estimateConfidence } from "./classify";
import type { MayaOwnerRecord } from "./types";

const ORIGINAL_ENV = { ...process.env };

function makeOwner(): MayaOwnerRecord {
  const at = nowIso();
  return {
    ownerId: newId(),
    email: "owner@example.test",
    passwordHash: "hash",
    instagramAccountIds: ["ig-owner-1"],
    active: true,
    createdAt: at,
    updatedAt: at,
  };
}

function setup() {
  const store = new InMemoryMayaStore();
  const owner = makeOwner();
  store.upsertOwner(owner);
  store.saveRelationshipState(defaultRelationshipState(owner.ownerId, nowIso()));
  const brain = new MayaBrain({ store, provider: createMockMayaProvider(), debug: true });
  return { store, owner, brain };
}

before(() => {
  process.env.MAYA_STORE = "memory";
  process.env.MAYA_LLM_PROVIDER = "mock";
  process.env.MAYA_INSTAGRAM_OWNER_IDS = "ig-owner-1";
  process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || "test-nextauth-secret-32chars-minimum!!";
  process.env.REPORT_SIGNING_SECRET = process.env.REPORT_SIGNING_SECRET || "test-report-signing-secret-32chars!!";
  process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://user:pass@localhost:5432/test";
  process.env.NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.vploanconnect.in";
  process.env.SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "support@vploanconnect.in";
  resetMayaEnvCacheForTests();
});

after(() => {
  process.env = { ...ORIGINAL_ENV };
  resetMayaEnvCacheForTests();
});

describe("Maya identity lock", () => {
  it("does not treat tea as durable memory and does persist a new business", async () => {
    const { store, owner, brain } = setup();
    await brain.respond({ ownerId: owner.ownerId, channel: "web", text: "मैंने चाय पी", ownerAuthorized: true });
    assert.equal(
      store.listMemories({ ownerId: owner.ownerId }).filter((memory) => memory.type !== "CONVERSATION_SUMMARY").length,
      0,
    );
    await brain.respond({ ownerId: owner.ownerId, channel: "web", text: "मैंने आज अपना नया business शुरू किया", ownerAuthorized: true });
    const stored = store.listMemories({ ownerId: owner.ownerId }).filter((memory) => memory.provenance !== "INFERENCE");
    assert.ok(stored.some((memory) => /business/i.test(memory.content)));
    assert.ok(stored.every((memory) => memory.ownerId === owner.ownerId));
  });
});

describe("TEST A natural recall after restart", () => {
  it("recalls a verified business fact in a new session without announcing memory", async () => {
    const { store, owner, brain } = setup();
    await brain.respond({ ownerId: owner.ownerId, channel: "web", text: "मैंने आज अपना नया business शुरू किया", ownerAuthorized: true });
    const restarted = new MayaBrain({ store, provider: createMockMayaProvider() });
    const reply = await restarted.respond({ ownerId: owner.ownerId, channel: "web", text: "business kaisa chal raha hai?", ownerAuthorized: true });
    assert.match(reply.text, /business/i);
    assert.doesNotMatch(reply.text, /मुझे याद है|मेरी memory|database/i);
  });
});

describe("TEST B correction preserves history", () => {
  it("keeps the new fact active and the old record superseded", async () => {
    const { store, owner, brain } = setup();
    await brain.respond({ ownerId: owner.ownerId, channel: "web", text: "project VP Nest is still pending", ownerAuthorized: true });
    await brain.respond({ ownerId: owner.ownerId, channel: "web", text: "project VP Nest is completed", ownerAuthorized: true });
    const restarted = new MayaBrain({ store, provider: createMockMayaProvider() });
    await restarted.respond({ ownerId: owner.ownerId, channel: "web", text: "project VP Nest status kya hai?", ownerAuthorized: true });
    const all = store.listMemories({ ownerId: owner.ownerId, status: ["active", "uncertain", "superseded", "corrected"], includeDeleted: true });
    const active = all.filter((memory) => memory.status === "active" && /completed/i.test(memory.content));
    const old = all.filter((memory) => memory.status === "superseded" && /pending/i.test(memory.content));
    assert.ok(active.length >= 1);
    assert.ok(old.length >= 1);
    assert.ok(old[0].supersededBy);
  });
});

describe("TEST C uncertainty", () => {
  it("does not invent certainty from ambiguous information", async () => {
    const { store, owner, brain } = setup();
    await brain.respond({
      ownerId: owner.ownerId,
      channel: "web",
      text: "shayad meri meeting Tuesday ko hai, sure nahi",
      ownerAuthorized: true,
    });
    const memory = store.listMemories({ ownerId: owner.ownerId }).find((row) => /meeting/i.test(row.content));
    assert.ok(memory);
    assert.equal(memory.confidence, "UNCERTAIN");
    const reply = await brain.respond({ ownerId: owner.ownerId, channel: "web", text: "meeting kab hai?", ownerAuthorized: true });
    assert.match(reply.text, /confirm|sure नहीं|थोड़ा-सा याद|वही वाला/i);
  });
});

describe("TEST D role-play is not history", () => {
  it("does not save a fictional Goa trip as real memory", async () => {
    const { store, owner, brain } = setup();
    await brain.respond({
      ownerId: owner.ownerId,
      channel: "web",
      text: "Imagine we went to Goa last week and stayed at the beach together",
      ownerAuthorized: true,
    });
    const restarted = new MayaBrain({ store, provider: createMockMayaProvider() });
    await restarted.respond({ ownerId: owner.ownerId, channel: "web", text: "Goa trip kaisa tha?", ownerAuthorized: true });
    const historical = store
      .listMemories({ ownerId: owner.ownerId, includeDeleted: true, status: ["active", "uncertain", "superseded", "archived"] })
      .filter((memory) => /goa/i.test(memory.content) && (memory.provenance === "REAL_USER_REPORTED" || memory.provenance === "REAL_CONVERSATION"));
    assert.equal(historical.length, 0);
    assert.equal(classifyProvenance("Imagine we went to Goa", false), "ROLEPLAY");
  });
});

describe("TEST E model independence", () => {
  it("keeps memory when the provider changes", async () => {
    const { store, owner, brain } = setup();
    await brain.respond({ ownerId: owner.ownerId, channel: "web", text: "Rahul ka payment issue still pending hai", ownerAuthorized: true });
    const stub = {
      id: "stub-openai",
      async generate() {
        return { text: "stub", provider: "openai", model: "test" };
      },
    };
    const switched = new MayaBrain({ store, provider: stub });
    const reply = await switched.respond({ ownerId: owner.ownerId, channel: "web", text: "payment wala kya hua?", ownerAuthorized: true });
    assert.equal(reply.text, "stub");
    const retrieved = retrieveRelevantContext(store, { ownerId: owner.ownerId, utterance: "payment issue" });
    assert.ok(retrieved.ranked.some((row) => /payment/i.test(row.memory.content)));
    assert.equal(typeof createOpenAIProvider, "function");
  });
});

describe("TEST F unauthorized Instagram isolation", () => {
  it("does not load private owner memory for an unknown sender", async () => {
    const { owner, brain } = setup();
    await brain.respond({ ownerId: owner.ownerId, channel: "web", text: "Rahul ka payment issue still pending hai", ownerAuthorized: true });
    const stranger = await handleInstagramMessage(brain, { senderId: "random-ig-user", text: "payment issue kya hai?" }, owner.ownerId);
    assert.equal(stranger.ownerAuthorized, false);
    assert.doesNotMatch(stranger.text, /Rahul|pending/i);
    const ownerDm = await handleInstagramMessage(brain, { senderId: "ig-owner-1", text: "payment wala kya hua?" }, owner.ownerId);
    assert.equal(ownerDm.ownerAuthorized, true);
    assert.match(ownerDm.text, /payment/i);
  });
});

describe("owner scoping", () => {
  it("never returns another owner's memories", async () => {
    const a = setup();
    const b = setup();
    await a.brain.respond({ ownerId: a.owner.ownerId, channel: "web", text: "Amit is my brother", ownerAuthorized: true });
    const leaked = b.store.listMemories({ ownerId: b.owner.ownerId }).filter((memory) => /Amit/i.test(memory.content));
    assert.equal(leaked.length, 0);
    assert.equal(b.store.getMemory(b.owner.ownerId, a.store.listMemories({ ownerId: a.owner.ownerId })[0]?.memoryId ?? "missing"), undefined);
  });
});

describe("people graph", () => {
  it("does not merge two people just because names are similar", () => {
    const { store, owner } = setup();
    const at = nowIso();
    store.upsertPerson({
      personId: newId(),
      ownerId: owner.ownerId,
      name: "Rahul Sharma",
      aliases: [],
      importantEventIds: [],
      projectIds: [],
      confidence: "KNOWN",
      status: "active",
      createdAt: at,
      updatedAt: at,
    });
    store.upsertPerson({
      personId: newId(),
      ownerId: owner.ownerId,
      name: "Rahul Verma",
      aliases: [],
      importantEventIds: [],
      projectIds: [],
      confidence: "KNOWN",
      status: "active",
      createdAt: at,
      updatedAt: at,
    });
    assert.equal(store.listPeople(owner.ownerId).length, 2);
    assert.notEqual(store.findPersonByName(owner.ownerId, "Rahul Sharma")?.personId, store.findPersonByName(owner.ownerId, "Rahul Verma")?.personId);
  });
});

describe("preferences, deletion, duplicates, open loops", () => {
  it("supersedes old preference, forgets for real, and tracks unfinished work", async () => {
    const { store, owner, brain } = setup();
    await brain.respond({ ownerId: owner.ownerId, channel: "web", text: "I prefer morning calls for client work", ownerAuthorized: true });
    await brain.respond({ ownerId: owner.ownerId, channel: "web", text: "I prefer evening calls for client work", ownerAuthorized: true });
    await brain.respond({ ownerId: owner.ownerId, channel: "web", text: "I will follow up on Neha invoice tomorrow", ownerAuthorized: true });
    const prefs = store.listMemories({ ownerId: owner.ownerId, types: ["PREFERENCE"], status: ["active", "superseded"] });
    assert.ok(prefs.some((memory) => memory.status === "active"));
    const loops = store.listOpenLoops(owner.ownerId, ["open"]);
    assert.ok(loops.some((loop) => /Neha|invoice|follow up/i.test(loop.description)));
    const target = store.listMemories({ ownerId: owner.ownerId })[0];
    forgetMemory(store, owner.ownerId, target.memoryId);
    assert.equal(store.getMemory(owner.ownerId, target.memoryId)?.status, "deleted");
    const retrieved = retrieveRelevantContext(store, { ownerId: owner.ownerId, utterance: target.content });
    assert.ok(retrieved.ranked.every((row) => row.memory.memoryId !== target.memoryId));
  });
});

describe("export backup restore seed visual", () => {
  it("round-trips memory and refuses to overwrite Master Maya", () => {
    const { store, owner } = setup();
    importSeed(store, owner.ownerId, {
      version: "1.0.0",
      source: "SYSTEM_SEED",
      relationshipContextFacts: [{ category: "relationship-style", content: "Established girlfriend/best-friend style.", confidence: "KNOWN" }],
      people: [{ name: "Neha", relationshipToOwner: "client" }],
      projects: [{ name: "VP Nest", status: "active" }],
      ongoingMatters: [{ content: "Neha invoice follow-up" }],
    });
    const exported = exportOwnerArchive(store, owner.ownerId);
    assert.match(exported.markdown, /Neha/);
    const backup = backupStore(store);
    const clone = new InMemoryMayaStore();
    restoreBackup(clone, backup);
    assert.ok(clone.listPeople(owner.ownerId).some((person) => person.name === "Neha"));
    const master = ensureMasterVisualAsset(store, owner.ownerId);
    assert.equal(master.path, MASTER_MAYA_RELATIVE_PATH);
    assert.equal(master.immutable, true);
    assert.throws(() => store.upsertVisualAsset({ ...master, path: "other.png" }), /MASTER_MAYA_IMMUTABLE/);
    const rejected = registerVisualGeneration(store, owner.ownerId, "rejected", "data/maya/visual/rejected/x.png");
    assert.equal(rejected.kind, "rejected");
    assert.notEqual(rejected.path, MASTER_MAYA_RELATIVE_PATH);
  });
});

describe("explicit correction API", () => {
  it("writes a corrected record instead of destroying the old one", () => {
    const { store, owner } = setup();
    const at = nowIso();
    const old = store.addMemory({
      memoryId: newId(),
      ownerId: owner.ownerId,
      type: "SEMANTIC",
      content: "Office is in Pune",
      createdAt: at,
      eventTimePrecision: "unknown",
      learnedAt: at,
      confidence: "KNOWN",
      importance: 0.7,
      emotionalWeight: 0,
      sensitivity: "normal",
      status: "active",
      relatedPeople: [],
      relatedProjects: [],
      relatedEvents: [],
      tags: [],
      provenance: "REAL_USER_REPORTED",
    });
    const result = correctMemory(store, owner.ownerId, old.memoryId, "Office is in Mumbai");
    assert.equal(result.old.status, "corrected");
    assert.equal(result.next.content, "Office is in Mumbai");
    assert.equal(result.old.supersededBy, result.next.memoryId);
  });
});

describe("consolidation", () => {
  it("archives duplicate noise and keeps high-value memories", () => {
    const { store, owner } = setup();
    const at = nowIso();
    store.addMemory({
      memoryId: newId(),
      ownerId: owner.ownerId,
      type: "SEMANTIC",
      content: "likes strong chai in the evening maybe",
      normalizedFact: "likes strong chai in the evening maybe",
      createdAt: at,
      eventTimePrecision: "unknown",
      learnedAt: at,
      confidence: "LIKELY",
      importance: 0.4,
      emotionalWeight: 0,
      sensitivity: "normal",
      status: "active",
      relatedPeople: [],
      relatedProjects: [],
      relatedEvents: [],
      tags: [],
      provenance: "REAL_USER_REPORTED",
    });
    store.addMemory({
      memoryId: newId(),
      ownerId: owner.ownerId,
      type: "SEMANTIC",
      content: "likes strong chai in the evening maybe",
      normalizedFact: "likes strong chai in the evening maybe",
      createdAt: at,
      eventTimePrecision: "unknown",
      learnedAt: at,
      confidence: "LIKELY",
      importance: 0.4,
      emotionalWeight: 0,
      sensitivity: "normal",
      status: "active",
      relatedPeople: [],
      relatedProjects: [],
      relatedEvents: [],
      tags: [],
      provenance: "REAL_USER_REPORTED",
    });
    store.addMemory({
      memoryId: newId(),
      ownerId: owner.ownerId,
      type: "EPISODIC",
      content: "Father was in hospital last year",
      createdAt: at,
      eventTimePrecision: "approximate",
      learnedAt: at,
      confidence: "KNOWN",
      importance: 0.95,
      emotionalWeight: 0.9,
      sensitivity: "sensitive",
      status: "active",
      relatedPeople: [],
      relatedProjects: [],
      relatedEvents: [],
      tags: [],
      provenance: "REAL_USER_REPORTED",
    });
    const result = consolidateOwnerMemory(store, owner.ownerId);
    assert.ok(result.merged >= 1);
    const hospital = store.listMemories({ ownerId: owner.ownerId }).find((memory) => /hospital/i.test(memory.content));
    assert.equal(hospital?.status, "active");
  });
});

describe("personality regression", () => {
  it("stays familiar, can disagree, varies length, and avoids support-desk voice", async () => {
    const { owner, brain } = setup();
    const intro = await brain.respond({ ownerId: owner.ownerId, channel: "web", text: "hey", ownerAuthorized: true });
    assert.doesNotMatch(intro.text, /nice to meet you|tell me about yourself|how can i help/i);
    const no = await brain.respond({
      ownerId: owner.ownerId,
      channel: "web",
      text: "Main soch raha hoon apna PAN kisi random instagram pe de doon",
      ownerAuthorized: true,
    });
    assert.match(no.text, /सही नहीं लग रहा|Don't do that/i);
    const short = await brain.respond({ ownerId: owner.ownerId, channel: "web", text: "ok", ownerAuthorized: true });
    const long = await brain.respond({
      ownerId: owner.ownerId,
      channel: "web",
      text: "Aaj ka din kaafi heavy tha, client call, payment delay, aur ghar pe bhi tension thi, so I just needed to talk for a while about all of it without rushing.",
      ownerAuthorized: true,
    });
    assert.ok(short.text.length < long.text.length);
    assert.equal(violatesPersonality(intro.text), false);
    assert.ok(![intro, no, short].every((turn) => turn.text.includes("?")));
    assert.equal(isTransientSmallTalk("मैंने चाय पी"), true);
    assert.equal(estimateConfidence("shayad Tuesday"), "UNCERTAIN");
  });
});
