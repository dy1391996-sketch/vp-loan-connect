import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { focusRecentMessages, looksLikeExplicitRecall, meaningfulOverlap } from "./topic-focus";
import { retrieveRelevantContext } from "./retrieval";
import { InMemoryMayaStore } from "./store";

describe("topic focus", () => {
  it("detects explicit recall asks", () => {
    assert.equal(looksLikeExplicitRecall("woh call kitne baje thi?"), true);
    assert.equal(looksLikeExplicitRecall("meri favourite chai kya hai?"), true);
    assert.equal(looksLikeExplicitRecall("kitne baje?"), false);
    assert.equal(looksLikeExplicitRecall("Rent 18000 salary 42000, what percent?"), false);
    assert.equal(looksLikeExplicitRecall("elaichi wali chai peene ka mann hai"), false);
  });

  it("keeps active topic turns and drops unrelated older digressions unless recalling", () => {
    const messages = [
      { role: "owner", text: "Maya, main aaj thak gaya hoon.", messageId: "1" },
      { role: "maya", text: "Rest le lo thoda. Business pe tension mat lo.", messageId: "2" },
      { role: "owner", text: "Call 6:15 pm hai.", messageId: "3" },
      { role: "maya", text: "Theek hai, 6:15.", messageId: "4" },
      { role: "owner", text: "elaichi wali chai peene ka mann hai", messageId: "5" },
      { role: "maya", text: "Chalo chai banate hain.", messageId: "6" },
    ];

    const rent = focusRecentMessages(
      [
        ...messages,
        { role: "owner", text: "Rent 18000 salary 42000, what percent?", messageId: "7" },
      ],
      "Rent 18000 salary 42000, what percent?",
    );
    assert.equal(rent.length, 1);
    assert.match(rent[0].text, /Rent 18000/);
    assert.equal(
      rent.some((row) => /thak|6:15|chai/i.test(row.text)),
      false,
      "new practical topic must not keep tired/call/chai monologue",
    );

    const chaiFocused = focusRecentMessages(messages, "bas elaichi chai ki baat kar");
    assert.ok(chaiFocused.some((row) => /elaichi|chai/i.test(row.text)));
    assert.equal(
      chaiFocused.some((row) => /6:15/.test(row.text)),
      false,
      "chai follow-up should not keep the call clock unless recalling",
    );

    const recall = focusRecentMessages(messages, "woh call kitne baje thi?");
    assert.ok(recall.some((row) => /6:15/.test(row.text)), "explicit recall must keep the stated call time");
  });

  it("does not inject unrelated call memories into a chai utterance", () => {
    const store = new InMemoryMayaStore();
    const ownerId = "owner-1";
    const at = new Date().toISOString();
    store.upsertOwner({
      ownerId,
      email: "topic-focus@example.test",
      passwordHash: "hash",
      instagramAccountIds: [],
      active: true,
      createdAt: at,
      updatedAt: at,
    });
    store.addMemory({
      memoryId: "m-call",
      ownerId,
      type: "PROJECT",
      content: "Kal subah client call hai, remind me in one line.",
      normalizedFact: "kal subah client call hai remind me in one line",
      sourceConversationId: undefined,
      createdAt: at,
      eventTimePrecision: "unknown",
      learnedAt: at,
      lastConfirmedAt: at,
      confidence: "KNOWN",
      importance: 0.7,
      emotionalWeight: 0.1,
      sensitivity: "normal",
      status: "active",
      relatedPeople: [],
      relatedProjects: [],
      relatedEvents: [],
      tags: [],
      provenance: "REAL_USER_REPORTED",
    });
    store.addMemory({
      memoryId: "m-chai",
      ownerId,
      type: "PREFERENCE",
      content: "favourite chai is elaichi",
      normalizedFact: "favourite chai is elaichi",
      sourceConversationId: undefined,
      createdAt: at,
      eventTimePrecision: "unknown",
      learnedAt: at,
      lastConfirmedAt: at,
      confidence: "KNOWN",
      importance: 0.6,
      emotionalWeight: 0.2,
      sensitivity: "normal",
      status: "active",
      relatedPeople: [],
      relatedProjects: [],
      relatedEvents: [],
      tags: [],
      provenance: "REAL_USER_REPORTED",
    });
    store.addMemory({
      memoryId: "m-summary",
      ownerId,
      type: "CONVERSATION_SUMMARY",
      content: "maya: Ohhh! Tumhare liye elaichi wali chai... agar pressure aaye toh plan chahiye.",
      normalizedFact: "maya elaichi wali chai pressure plan",
      sourceConversationId: undefined,
      createdAt: at,
      eventTimePrecision: "unknown",
      learnedAt: at,
      lastConfirmedAt: at,
      confidence: "LIKELY",
      importance: 0.4,
      emotionalWeight: 0.1,
      sensitivity: "normal",
      status: "active",
      relatedPeople: [],
      relatedProjects: [],
      relatedEvents: [],
      tags: ["summary"],
      provenance: "REAL_CONVERSATION",
    });

    const chai = retrieveRelevantContext(store, { ownerId, utterance: "elaichi wali chai peene ka mann hai" });
    assert.ok(chai.ranked.some((row) => row.memory.memoryId === "m-chai"));
    assert.equal(chai.ranked.some((row) => row.memory.memoryId === "m-call"), false);
    assert.equal(chai.ranked.some((row) => row.memory.memoryId === "m-summary"), false);

    const rent = retrieveRelevantContext(store, {
      ownerId,
      utterance: "Rent 18000 salary 42000, what percent?",
    });
    assert.equal(rent.ranked.some((row) => /call|chai|elaichi/i.test(row.memory.content)), false);

    const recall = retrieveRelevantContext(store, { ownerId, utterance: "woh call kitne baje thi?" });
    assert.ok(recall.ranked.some((row) => row.memory.memoryId === "m-call"));
  });

  it("does not inject a timed call memory into an unrelated doctor appointment ask", () => {
    const store = new InMemoryMayaStore();
    const ownerId = "owner-clock";
    const at = new Date().toISOString();
    store.upsertOwner({
      ownerId,
      email: "clock-focus@example.test",
      passwordHash: "hash",
      instagramAccountIds: [],
      active: true,
      createdAt: at,
      updatedAt: at,
    });
    store.addMemory({
      memoryId: "m-timed-call",
      ownerId,
      type: "PROJECT",
      content: "Kal shaam 6:15 baje client call hai.",
      normalizedFact: "kal shaam 6:15 baje client call hai",
      sourceConversationId: undefined,
      createdAt: at,
      eventTimePrecision: "unknown",
      learnedAt: at,
      lastConfirmedAt: at,
      confidence: "KNOWN",
      importance: 0.8,
      emotionalWeight: 0.1,
      sensitivity: "normal",
      status: "active",
      relatedPeople: [],
      relatedProjects: [],
      relatedEvents: [],
      tags: [],
      provenance: "REAL_USER_REPORTED",
    });

    const appt = retrieveRelevantContext(store, {
      ownerId,
      utterance: "Doctor ka appointment hai. Kitne baje hai?",
    });
    assert.equal(
      appt.ranked.some((row) => row.memory.memoryId === "m-timed-call"),
      false,
      "bare kitne-baje appointment ask must not pull an unrelated call clock",
    );

    const recall = retrieveRelevantContext(store, { ownerId, utterance: "woh call kitne baje thi?" });
    assert.ok(recall.ranked.some((row) => row.memory.memoryId === "m-timed-call"));
  });

  it("meaningful overlap ignores stopwords like hai", () => {
    assert.equal(meaningfulOverlap("favourite chai is elaichi", "Kal shaam ek call hai."), 0);
  });
});
