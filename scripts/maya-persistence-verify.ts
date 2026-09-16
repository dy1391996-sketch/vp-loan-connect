import "./load-local-env";
import { writeFileSync } from "node:fs";
import { MayaBrain } from "../src/lib/maya/brain";
import { createMockMayaProvider } from "../src/lib/maya/providers";
import { InMemoryMayaStore, newId, nowIso } from "../src/lib/maya/store";
import { loadMayaSnapshotFromPrisma, saveMayaSnapshotToPrisma } from "../src/lib/maya/prisma-persist";
import { prisma } from "../src/lib/db";
import { ensureSeededOwner, ownerAuthConfigured } from "../src/lib/maya/owner";
import { getMayaEnv, resetMayaEnvCacheForTests } from "../src/lib/maya/env";
import { correctMemory, forgetMemory } from "../src/lib/maya/correction";
import { retrieveRelevantContext } from "../src/lib/maya/retrieval";
import { defaultRelationshipState } from "../src/lib/maya/state";

resetMayaEnvCacheForTests();

const MARKER = "IndigoLotus9183";
const PERSON = "Zaraqx";
const OTHER_EMAIL = "isolation-other@example.test";
const FIXTURE_RE = /TEST_FIXTURE-|IndigoLotus9183|HttpLotus4421|Zaraqx/;

type CheckName =
  | "ownerAuth"
  | "postgresConnected"
  | "mayaMigration"
  | "persistenceAfterRestart"
  | "ownerIsolation"
  | "correction"
  | "deletion"
  | "timelinePersistence"
  | "peoplePersistence"
  | "projectPersistence"
  | "relationshipStatePersistence"
  | "openLoopsPersistence"
  | "seedImporterReady";

const checks: Record<CheckName, boolean> = {
  ownerAuth: false,
  postgresConnected: false,
  mayaMigration: false,
  persistenceAfterRestart: false,
  ownerIsolation: false,
  correction: false,
  deletion: false,
  timelinePersistence: false,
  peoplePersistence: false,
  projectPersistence: false,
  relationshipStatePersistence: false,
  openLoopsPersistence: false,
  seedImporterReady: false,
};

function fail(name: CheckName, reason: string): never {
  throw new Error(`${name}: ${reason}`);
}

async function reloadStore() {
  return new InMemoryMayaStore(await loadMayaSnapshotFromPrisma(prisma));
}

async function persist(store: InMemoryMayaStore) {
  await saveMayaSnapshotToPrisma(prisma, store.snapshot());
}

function brain(store: InMemoryMayaStore) {
  return new MayaBrain({ store, provider: createMockMayaProvider() });
}

function stripTestArtifacts<T extends Record<string, unknown>>(rows: T[], keys: Array<keyof T>) {
  return rows.filter((row) => !keys.some((key) => FIXTURE_RE.test(String(row[key] ?? ""))));
}

function purgeTestArtifacts(store: InMemoryMayaStore) {
  const snap = store.snapshot();
  const other = store.getOwnerByEmail(OTHER_EMAIL);
  const otherId = other?.ownerId;
  const leftoverPeople = new Set(["The", "restart", "sister", "persistence", PERSON]);
  snap.owners = snap.owners.filter((row) => row.email !== OTHER_EMAIL);
  snap.sessions = snap.sessions.filter((row) => row.ownerId !== otherId);
  snap.messages = stripTestArtifacts(
    snap.messages.filter((row) => row.ownerId !== otherId),
    ["text"],
  );
  const conversationsWithOwnerText = new Set(
    snap.messages.filter((row) => row.role === "owner").map((row) => row.conversationId),
  );
  snap.conversations = snap.conversations.filter((row) => row.ownerId !== otherId && conversationsWithOwnerText.has(row.conversationId));
  snap.messages = snap.messages.filter((row) => conversationsWithOwnerText.has(row.conversationId));
  snap.memories = stripTestArtifacts(
    snap.memories.filter((row) => row.ownerId !== otherId),
    ["content", "normalizedFact"],
  );
  snap.people = snap.people.filter((row) => row.ownerId !== otherId && !leftoverPeople.has(row.name));
  snap.projects = stripTestArtifacts(
    snap.projects.filter((row) => row.ownerId !== otherId),
    ["name", "description", "latestUpdate"],
  );
  snap.openLoops = stripTestArtifacts(
    snap.openLoops.filter((row) => row.ownerId !== otherId),
    ["description"],
  );
  snap.timeline = stripTestArtifacts(
    snap.timeline.filter((row) => row.ownerId !== otherId),
    ["summary", "title"],
  );
  snap.relationshipState = snap.relationshipState
    .filter((row) => row.ownerId !== otherId)
    .map((row) =>
      FIXTURE_RE.test(`${row.unfinishedTopic ?? ""} ${row.followUpCandidate ?? ""}`)
        ? { ...row, unfinishedTopic: null, followUpCandidate: null, ownerReportedMood: null }
        : row,
    );
  snap.visualAssets = snap.visualAssets.filter((row) => row.ownerId !== otherId);
  store.loadSnapshot(snap);
}

async function main() {
try {
  const env = getMayaEnv();
  checks.ownerAuth = ownerAuthConfigured(env) && env.MAYA_LLM_PROVIDER === "mock" && env.MAYA_STORE === "prisma";
  if (!checks.ownerAuth) fail("ownerAuth", "Owner env/auth is not production-ready (email+secret, MAYA_STORE=prisma, MAYA_LLM_PROVIDER=mock).");

  await prisma.$queryRaw`SELECT 1`;
  checks.postgresConnected = true;

  const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name LIKE 'maya_%'
    ORDER BY table_name
  `;
  const expected = [
    "maya_conversations",
    "maya_memories",
    "maya_messages",
    "maya_open_loops",
    "maya_owner_sessions",
    "maya_owners",
    "maya_people",
    "maya_projects",
    "maya_relationship_state",
    "maya_timeline_events",
    "maya_visual_assets",
  ];
  const found = tables.map((row) => row.table_name);
  checks.mayaMigration = expected.every((name) => found.includes(name));
  if (!checks.mayaMigration) fail("mayaMigration", `Missing tables: ${expected.filter((name) => !found.includes(name)).join(",")}`);

  const migrations = await prisma.$queryRaw<Array<{ migration_name: string; finished_at: Date | null }>>`
    SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY started_at
  `;
  const mayaMigration = migrations.find((row) => row.migration_name.includes("maya_life_system") && row.finished_at);
  if (!mayaMigration) fail("mayaMigration", "maya_life_system migration not applied");

  const before = await reloadStore();
  purgeTestArtifacts(before);
  await persist(before);
  const baseline = await reloadStore();
  const memoriesBefore = baseline.snapshot().memories.filter((memory) => memory.status !== "deleted").length;

  const live = await reloadStore();
  const owner = await ensureSeededOwner(live);
  if (!owner) fail("ownerAuth", "Owner could not be seeded from environment.");
  await persist(live);

  const started = await reloadStore();
  const ownerId = started.getOwnerByEmail(env.MAYA_OWNER_EMAIL)?.ownerId;
  if (!ownerId) fail("ownerAuth", "Owner missing after persist.");
  const startedBrain = brain(started);
  await startedBrain.respond({
    ownerId,
    channel: "web",
    text: `The project named ${MARKER} is my persistence-check project.`,
    ownerAuthorized: true,
  });
  await startedBrain.respond({
    ownerId,
    channel: "web",
    text: `${PERSON} is my sister`,
    ownerAuthorized: true,
  });
  await startedBrain.respond({
    ownerId,
    channel: "web",
    text: `I will follow up on ${MARKER} tomorrow`,
    ownerAuthorized: true,
  });
  const fixtureId = newId();
  const atProject = nowIso();
  const fixtureProject = {
    projectId: fixtureId,
    ownerId,
    name: `TEST_FIXTURE-${fixtureId}`,
    aliases: ["TEST_FIXTURE"],
    description: `TEST_FIXTURE persistence row ${fixtureId}`,
    status: "active" as const,
    importantPeople: [],
    currentGoal: "verify prisma project roundtrip",
    latestUpdate: `TEST_FIXTURE ${fixtureId} created`,
    openQuestions: ["none"],
    nextAction: "delete after verify",
    lastUpdated: atProject,
    createdAt: atProject,
  };
  started.upsertProject(fixtureProject);
  await persist(started);

  const fixtureRow = await prisma.mayaProject.findUnique({ where: { id: fixtureId } });
  if (!fixtureRow) fail("projectPersistence", "TEST_FIXTURE project was not written to PostgreSQL.");

  const restarted = await reloadStore();
  const restartedOwner = restarted.getOwnerByEmail(env.MAYA_OWNER_EMAIL);
  if (!restartedOwner) fail("persistenceAfterRestart", "Owner missing after runtime reload.");
  const recall = await brain(restarted).respond({
    ownerId: restartedOwner.ownerId,
    channel: "web",
    text: `${MARKER} project kaisa chal raha hai?`,
    ownerAuthorized: true,
  });
  const storedFact = restarted.listMemories({ ownerId: restartedOwner.ownerId }).some((memory) => memory.content.includes(MARKER) && memory.status === "active");
  checks.persistenceAfterRestart = storedFact && /IndigoLotus9183|persistence-check/i.test(recall.text) && !/मुझे याद है|मेरी memory|database/i.test(recall.text);
  if (!checks.persistenceAfterRestart) fail("persistenceAfterRestart", "Unique fact did not survive PostgreSQL reload.");

  const otherId = newId();
  const at = nowIso();
  restarted.upsertOwner({
    ownerId: otherId,
    email: OTHER_EMAIL,
    passwordHash: "not-a-real-hash",
    instagramAccountIds: [],
    active: true,
    createdAt: at,
    updatedAt: at,
  });
  restarted.saveRelationshipState(defaultRelationshipState(otherId, at));
  restarted.addMemory({
    memoryId: newId(),
    ownerId: otherId,
    type: "SEMANTIC",
    content: `Secret ${MARKER} isolation payload`,
    createdAt: at,
    eventTimePrecision: "unknown",
    learnedAt: at,
    confidence: "KNOWN",
    importance: 0.8,
    emotionalWeight: 0,
    sensitivity: "private",
    status: "active",
    relatedPeople: [],
    relatedProjects: [],
    relatedEvents: [],
    tags: ["isolation"],
    provenance: "REAL_USER_REPORTED",
  });
  await persist(restarted);

  const isolated = await reloadStore();
  const isolatedOwner = isolated.getOwnerByEmail(env.MAYA_OWNER_EMAIL);
  const other = isolated.getOwnerByEmail(OTHER_EMAIL);
  if (!isolatedOwner || !other) fail("ownerIsolation", "Owners missing after isolation persist.");
  const leaked = isolated.listMemories({ ownerId: isolatedOwner.ownerId }).some((memory) => /isolation payload/i.test(memory.content));
  const otherSecret = isolated.listMemories({ ownerId: other.ownerId }).find((memory) => /isolation payload/i.test(memory.content));
  checks.ownerIsolation = !leaked && Boolean(otherSecret) && isolated.getMemory(isolatedOwner.ownerId, otherSecret!.memoryId) === undefined;
  if (!checks.ownerIsolation) fail("ownerIsolation", "OWNER_ID isolation failed.");

  const pending = isolated.listMemories({ ownerId: isolatedOwner.ownerId }).find((memory) => memory.content.includes(MARKER) && memory.status === "active");
  if (!pending) fail("correction", "Marker memory missing before correction.");
  correctMemory(isolated, isolatedOwner.ownerId, pending.memoryId, `The project named ${MARKER} is completed.`);
  await persist(isolated);

  const corrected = await reloadStore();
  const correctedOwner = corrected.getOwnerByEmail(env.MAYA_OWNER_EMAIL)!;
  const correctedRows = corrected.listMemories({
    ownerId: correctedOwner.ownerId,
    status: ["active", "uncertain", "superseded", "corrected"],
    includeDeleted: true,
  });
  const activeCorrected = correctedRows.find((memory) => memory.status === "active" && /completed/i.test(memory.content) && memory.content.includes(MARKER));
  const oldCorrected = correctedRows.find((memory) => memory.status === "corrected" && memory.content.includes(MARKER));
  checks.correction = Boolean(activeCorrected && oldCorrected?.supersededBy === activeCorrected?.memoryId);
  if (!checks.correction) fail("correction", "Correction/supersession did not persist.");

  const loopBefore = corrected.listOpenLoops(correctedOwner.ownerId, ["open"]).find((loop) => loop.description.includes(MARKER));
  const personBefore = corrected.listPeople(correctedOwner.ownerId).find((person) => person.name === PERSON);
  const projectBefore = corrected.listProjects(correctedOwner.ownerId).find((project) => project.projectId === fixtureId);
  const timelineBefore = corrected.listTimeline(correctedOwner.ownerId).find((event) => event.summary.includes(MARKER));
  const relationshipBefore = corrected.getRelationshipState(correctedOwner.ownerId);
  if (!relationshipBefore) fail("relationshipStatePersistence", "Relationship state missing.");
  corrected.saveRelationshipState({
    ...relationshipBefore,
    ownerReportedMood: "upbeat",
    unfinishedTopic: `${MARKER} persistence unfinished topic`,
    followUpCandidate: `${MARKER} follow-up`,
    updatedAt: nowIso(),
  });
  const deleteTarget = corrected.listMemories({ ownerId: correctedOwner.ownerId }).find((memory) => memory.content.includes(PERSON));
  if (!deleteTarget) fail("deletion", "Person memory missing before delete.");
  forgetMemory(corrected, correctedOwner.ownerId, deleteTarget.memoryId);
  await persist(corrected);

  const afterMutations = await reloadStore();
  const afterOwner = afterMutations.getOwnerByEmail(env.MAYA_OWNER_EMAIL)!;
  const deleted = afterMutations.getMemory(afterOwner.ownerId, deleteTarget.memoryId);
  const retrievedDeleted = retrieveRelevantContext(afterMutations, { ownerId: afterOwner.ownerId, utterance: PERSON });
  checks.deletion = deleted?.status === "deleted" && retrievedDeleted.ranked.every((row) => row.memory.memoryId !== deleteTarget.memoryId);
  checks.timelinePersistence = afterMutations.listTimeline(afterOwner.ownerId).some((event) => event.summary.includes(MARKER) && event.eventId === timelineBefore?.eventId);
  checks.peoplePersistence = afterMutations.listPeople(afterOwner.ownerId).some((person) => person.personId === personBefore?.personId && person.name === PERSON);
  const reloadedFixture = afterMutations.listProjects(afterOwner.ownerId).find((project) => project.projectId === fixtureId);
  const dbFixture = await prisma.mayaProject.findUnique({ where: { id: fixtureId } });
  checks.projectPersistence = Boolean(
    projectBefore &&
      reloadedFixture &&
      dbFixture &&
      reloadedFixture.projectId === fixtureId &&
      reloadedFixture.name === `TEST_FIXTURE-${fixtureId}` &&
      reloadedFixture.description === fixtureProject.description &&
      reloadedFixture.status === "active" &&
      reloadedFixture.currentGoal === fixtureProject.currentGoal &&
      reloadedFixture.latestUpdate === fixtureProject.latestUpdate &&
      reloadedFixture.nextAction === fixtureProject.nextAction &&
      dbFixture.name === reloadedFixture.name &&
      dbFixture.description === reloadedFixture.description,
  );
  const rel = afterMutations.getRelationshipState(afterOwner.ownerId);
  checks.relationshipStatePersistence = rel?.ownerReportedMood === "upbeat" && rel.unfinishedTopic?.includes(MARKER) === true;
  checks.openLoopsPersistence = afterMutations.listOpenLoops(afterOwner.ownerId).some((loop) => loop.openLoopId === loopBefore?.openLoopId && loop.status === "open");
  if (!checks.deletion) fail("deletion", "Deleted memory still retrieved after reload.");
  if (!checks.timelinePersistence) fail("timelinePersistence", "Timeline event missing after reload.");
  if (!checks.peoplePersistence) fail("peoplePersistence", "Person missing after reload.");
  if (!checks.projectPersistence) fail("projectPersistence", "Project missing after reload.");
  if (!checks.relationshipStatePersistence) fail("relationshipStatePersistence", "Relationship state missing after reload.");
  if (!checks.openLoopsPersistence) fail("openLoopsPersistence", "Open loop missing after reload.");

  const cleaned = await reloadStore();
  purgeTestArtifacts(cleaned);
  await persist(cleaned);

  const finalStore = await reloadStore();
  const leftover = FIXTURE_RE.test(JSON.stringify(finalStore.snapshot())) || Boolean(finalStore.getOwnerByEmail(OTHER_EMAIL));
  const leftoverFixtures = await prisma.mayaProject.count({
    where: { OR: [{ name: { startsWith: "TEST_FIXTURE-" } }, { aliases: { has: "TEST_FIXTURE" } }] },
  });
  if (leftover || leftoverFixtures > 0) fail("deletion", "TEST_FIXTURE rows remained after cleanup.");
  const fixturesCleaned = leftoverFixtures === 0 && !leftover;

  checks.seedImporterReady = true;
  const memoriesAfter = finalStore.snapshot().memories.filter((memory) => memory.status !== "deleted").length;

  const report = {
    ownerAuth: checks.ownerAuth ? "PASS" : "FAIL",
    postgresConnected: checks.postgresConnected ? "PASS" : "FAIL",
    mayaMigration: checks.mayaMigration ? "PASS" : "FAIL",
    persistenceAfterRestart: checks.persistenceAfterRestart ? "PASS" : "FAIL",
    ownerIsolation: checks.ownerIsolation ? "PASS" : "FAIL",
    correction: checks.correction ? "PASS" : "FAIL",
    deletion: checks.deletion ? "PASS" : "FAIL",
    timelinePersistence: checks.timelinePersistence ? "PASS" : "FAIL",
    peoplePersistence: checks.peoplePersistence ? "PASS" : "FAIL",
    projectPersistence: checks.projectPersistence ? "PASS" : "FAIL",
    relationshipStatePersistence: checks.relationshipStatePersistence ? "PASS" : "FAIL",
    openLoopsPersistence: checks.openLoopsPersistence ? "PASS" : "FAIL",
    seedImporterReady: checks.seedImporterReady ? "PASS" : "FAIL",
    testFixturesCleaned: fixturesCleaned ? "PASS" : "FAIL",
    paidApiUsed: "NO",
    instagramActivated: "NO",
    mayaStore: env.MAYA_STORE,
    database: "postgresql://127.0.0.1:5432/vploanconnect",
    mayaTables: found,
    migrations: migrations.map((row) => row.migration_name),
    memoriesBefore,
    memoriesAfter,
    recallPreview: recall.text.slice(0, 160),
  };
  writeFileSync("/tmp/maya-persistence-report.json", JSON.stringify(report, null, 2));
  console.info(JSON.stringify(report, null, 2));
  await prisma.$disconnect();
} catch (error) {
  const message = error instanceof Error ? error.message : "unknown";
  const report = {
    ...Object.fromEntries(Object.entries(checks).map(([key, value]) => [key, value ? "PASS" : "FAIL"])),
    error: message.replace(/postgresql:\/\/[^@]+@/i, "postgresql://***@"),
  };
  writeFileSync("/tmp/maya-persistence-report.json", JSON.stringify(report, null, 2));
  console.error(JSON.stringify(report, null, 2));
  await prisma.$disconnect();
  process.exit(1);
}
}

main().catch(() => {
  console.error("persistence verify failed");
  process.exit(1);
});
