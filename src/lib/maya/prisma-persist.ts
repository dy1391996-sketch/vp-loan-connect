import type { PrismaClient } from "@prisma/client";
import type {
  AffectionMode,
  MayaChannel,
  MayaConfidence,
  MayaConversation,
  MayaMemory,
  MayaMemoryStatus,
  MayaMemoryType,
  MayaMessage,
  MayaOpenLoop,
  MayaOwnerRecord,
  MayaPerson,
  MayaProject,
  MayaProvenance,
  MayaRelationshipState,
  MayaSession,
  MayaTimelineEvent,
  MayaVisualAsset,
} from "./types";
import { emptySnapshot, type MayaStoreSnapshot } from "./store";

type PrismaLike = Pick<
  PrismaClient,
  | "mayaOwner"
  | "mayaOwnerSession"
  | "mayaConversation"
  | "mayaMessage"
  | "mayaMemoryRecord"
  | "mayaPerson"
  | "mayaProject"
  | "mayaOpenLoop"
  | "mayaTimelineEvent"
  | "mayaRelationshipState"
  | "mayaVisualAsset"
> & { $transaction: PrismaClient["$transaction"] };

export async function loadMayaSnapshotFromPrisma(prisma: PrismaLike): Promise<MayaStoreSnapshot> {
  const [owners, sessions, conversations, messages, memories, people, projects, openLoops, timeline, relationshipState, visualAssets] = await Promise.all([
    prisma.mayaOwner.findMany(),
    prisma.mayaOwnerSession.findMany(),
    prisma.mayaConversation.findMany(),
    prisma.mayaMessage.findMany(),
    prisma.mayaMemoryRecord.findMany(),
    prisma.mayaPerson.findMany(),
    prisma.mayaProject.findMany(),
    prisma.mayaOpenLoop.findMany(),
    prisma.mayaTimelineEvent.findMany(),
    prisma.mayaRelationshipState.findMany(),
    prisma.mayaVisualAsset.findMany(),
  ]);

  return {
    owners: owners.map(mapOwner),
    sessions: sessions.map(mapSession),
    conversations: conversations.map(mapConversation),
    messages: messages.map(mapMessage),
    memories: memories.map(mapMemory),
    people: people.map(mapPerson),
    projects: projects.map(mapProject),
    openLoops: openLoops.map(mapLoop),
    timeline: timeline.map(mapTimeline),
    relationshipState: relationshipState.map(mapState),
    visualAssets: visualAssets.map(mapVisual),
  };
}

export async function saveMayaSnapshotToPrisma(prisma: PrismaLike, snapshot: MayaStoreSnapshot) {
  await prisma.$transaction(async (tx) => {
    await tx.mayaVisualAsset.deleteMany();
    await tx.mayaTimelineEvent.deleteMany();
    await tx.mayaOpenLoop.deleteMany();
    await tx.mayaProject.deleteMany();
    await tx.mayaPerson.deleteMany();
    await tx.mayaMemoryRecord.deleteMany();
    await tx.mayaMessage.deleteMany();
    await tx.mayaConversation.deleteMany();
    await tx.mayaOwnerSession.deleteMany();
    await tx.mayaRelationshipState.deleteMany();
    await tx.mayaOwner.deleteMany();

    if (snapshot.owners.length) {
      await tx.mayaOwner.createMany({
        data: snapshot.owners.map((owner) => ({
          id: owner.ownerId,
          email: owner.email,
          passwordHash: owner.passwordHash,
          displayName: owner.displayName,
          instagramAccountIds: owner.instagramAccountIds,
          active: owner.active,
          createdAt: new Date(owner.createdAt),
          updatedAt: new Date(owner.updatedAt),
        })),
      });
    }
    if (snapshot.sessions.length) {
      await tx.mayaOwnerSession.createMany({
        data: snapshot.sessions.map((session) => ({
          id: session.sessionId,
          ownerId: session.ownerId,
          tokenHash: session.tokenHash,
          expiresAt: new Date(session.expiresAt),
          revokedAt: session.revokedAt ? new Date(session.revokedAt) : null,
          createdAt: new Date(session.createdAt),
        })),
      });
    }
    if (snapshot.conversations.length) {
      await tx.mayaConversation.createMany({
        data: snapshot.conversations.map((conversation) => ({
          id: conversation.conversationId,
          ownerId: conversation.ownerId,
          channel: conversation.channel.toUpperCase() as never,
          title: conversation.title,
          createdAt: new Date(conversation.createdAt),
          updatedAt: new Date(conversation.updatedAt),
          closedAt: conversation.closedAt ? new Date(conversation.closedAt) : null,
          roleplayActive: conversation.roleplayActive,
        })),
      });
    }
    if (snapshot.messages.length) {
      await tx.mayaMessage.createMany({
        data: snapshot.messages.map((message) => ({
          id: message.messageId,
          conversationId: message.conversationId,
          ownerId: message.ownerId,
          role: message.role,
          channel: message.channel.toUpperCase() as never,
          text: message.text,
          createdAt: new Date(message.createdAt),
          roleplay: message.roleplay,
        })),
      });
    }
    if (snapshot.memories.length) {
      await tx.mayaMemoryRecord.createMany({
        data: snapshot.memories.map((memory) => ({
          id: memory.memoryId,
          ownerId: memory.ownerId,
          type: memory.type,
          subtype: memory.subtype,
          content: memory.content,
          normalizedFact: memory.normalizedFact,
          sourceConversationId: memory.sourceConversationId,
          sourceMessageId: memory.sourceMessageId,
          createdAt: new Date(memory.createdAt),
          eventTime: memory.eventTime ? new Date(memory.eventTime) : null,
          eventTimePrecision: memory.eventTimePrecision,
          learnedAt: new Date(memory.learnedAt),
          lastConfirmedAt: memory.lastConfirmedAt ? new Date(memory.lastConfirmedAt) : null,
          confidence: memory.confidence,
          importance: memory.importance,
          emotionalWeight: memory.emotionalWeight,
          sensitivity: memory.sensitivity,
          status: memory.status.toUpperCase() as never,
          supersededBy: memory.supersededBy,
          relatedPeople: memory.relatedPeople,
          relatedProjects: memory.relatedProjects,
          relatedEvents: memory.relatedEvents,
          tags: memory.tags,
          provenance: memory.provenance,
        })),
      });
    }
    if (snapshot.people.length) {
      await tx.mayaPerson.createMany({
        data: snapshot.people.map((person) => ({
          id: person.personId,
          ownerId: person.ownerId,
          name: person.name,
          aliases: person.aliases,
          relationshipToOwner: person.relationshipToOwner,
          relevantContext: person.relevantContext,
          importantEventIds: person.importantEventIds,
          projectIds: person.projectIds,
          lastMentioned: person.lastMentioned ? new Date(person.lastMentioned) : null,
          confidence: person.confidence,
          status: person.status.toUpperCase() as never,
          createdAt: new Date(person.createdAt),
          updatedAt: new Date(person.updatedAt),
        })),
      });
    }
    if (snapshot.projects.length) {
      await tx.mayaProject.createMany({
        data: snapshot.projects.map((project) => ({
          id: project.projectId,
          ownerId: project.ownerId,
          name: project.name,
          aliases: project.aliases,
          description: project.description,
          status: project.status.toUpperCase() as never,
          importantPeople: project.importantPeople,
          currentGoal: project.currentGoal,
          latestUpdate: project.latestUpdate,
          openQuestions: project.openQuestions,
          nextAction: project.nextAction,
          lastUpdated: new Date(project.lastUpdated),
          createdAt: new Date(project.createdAt),
        })),
      });
    }
    if (snapshot.openLoops.length) {
      await tx.mayaOpenLoop.createMany({
        data: snapshot.openLoops.map((loop) => ({
          id: loop.openLoopId,
          ownerId: loop.ownerId,
          description: loop.description,
          createdAt: new Date(loop.createdAt),
          dueAt: loop.dueAt ? new Date(loop.dueAt) : null,
          status: loop.status.toUpperCase() as never,
          importance: loop.importance,
          relatedMemoryId: loop.relatedMemoryId,
          lastDiscussed: loop.lastDiscussed ? new Date(loop.lastDiscussed) : null,
        })),
      });
    }
    if (snapshot.timeline.length) {
      await tx.mayaTimelineEvent.createMany({
        data: snapshot.timeline.map((event) => ({
          id: event.eventId,
          ownerId: event.ownerId,
          title: event.title,
          summary: event.summary,
          occurredAt: event.occurredAt ? new Date(event.occurredAt) : null,
          precision: event.precision,
          memoryIds: event.memoryIds,
          createdAt: new Date(event.createdAt),
        })),
      });
    }
    if (snapshot.relationshipState.length) {
      await tx.mayaRelationshipState.createMany({
        data: snapshot.relationshipState.map((state) => ({
          ownerId: state.ownerId,
          conversationTone: state.conversationTone,
          ownerReportedMood: state.ownerReportedMood,
          interactionIntensity: state.interactionIntensity,
          affectionContext: state.affectionContext,
          seriousness: state.seriousness,
          playfulness: state.playfulness,
          unresolvedTension: state.unresolvedTension,
          recentPositiveEvent: state.recentPositiveEvent,
          recentDifficultEvent: state.recentDifficultEvent,
          lastConversationSummary: state.lastConversationSummary,
          unfinishedTopic: state.unfinishedTopic,
          followUpCandidate: state.followUpCandidate,
          languageStyle: state.languageStyle,
          updatedAt: new Date(state.updatedAt),
        })),
      });
    }
    if (snapshot.visualAssets.length) {
      await tx.mayaVisualAsset.createMany({
        data: snapshot.visualAssets.map((asset) => ({
          id: asset.assetId,
          ownerId: asset.ownerId,
          kind: asset.kind.toUpperCase() as never,
          path: asset.path,
          note: asset.note,
          immutable: asset.immutable,
          createdAt: new Date(asset.createdAt),
        })),
      });
    }
  });
}

function iso(value: Date | null | undefined) {
  return value ? value.toISOString() : undefined;
}

function mapOwner(row: Awaited<ReturnType<PrismaLike["mayaOwner"]["findMany"]>>[number]): MayaOwnerRecord {
  return {
    ownerId: row.id,
    email: row.email,
    passwordHash: row.passwordHash,
    displayName: row.displayName ?? undefined,
    instagramAccountIds: row.instagramAccountIds,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapSession(row: Awaited<ReturnType<PrismaLike["mayaOwnerSession"]["findMany"]>>[number]): MayaSession {
  return {
    sessionId: row.id,
    ownerId: row.ownerId,
    tokenHash: row.tokenHash,
    expiresAt: row.expiresAt.toISOString(),
    revokedAt: iso(row.revokedAt) ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapConversation(row: Awaited<ReturnType<PrismaLike["mayaConversation"]["findMany"]>>[number]): MayaConversation {
  return {
    conversationId: row.id,
    ownerId: row.ownerId,
    channel: row.channel.toLowerCase() as MayaChannel,
    title: row.title ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    closedAt: iso(row.closedAt) ?? null,
    roleplayActive: row.roleplayActive,
  };
}

function mapMessage(row: Awaited<ReturnType<PrismaLike["mayaMessage"]["findMany"]>>[number]): MayaMessage {
  return {
    messageId: row.id,
    conversationId: row.conversationId,
    ownerId: row.ownerId,
    role: row.role as MayaMessage["role"],
    channel: row.channel.toLowerCase() as MayaChannel,
    text: row.text,
    createdAt: row.createdAt.toISOString(),
    roleplay: row.roleplay,
  };
}

function mapMemory(row: Awaited<ReturnType<PrismaLike["mayaMemoryRecord"]["findMany"]>>[number]): MayaMemory {
  return {
    memoryId: row.id,
    ownerId: row.ownerId,
    type: row.type as MayaMemoryType,
    subtype: row.subtype ?? undefined,
    content: row.content,
    normalizedFact: row.normalizedFact ?? undefined,
    sourceConversationId: row.sourceConversationId ?? undefined,
    sourceMessageId: row.sourceMessageId ?? undefined,
    createdAt: row.createdAt.toISOString(),
    eventTime: iso(row.eventTime) ?? null,
    eventTimePrecision: row.eventTimePrecision as MayaMemory["eventTimePrecision"],
    learnedAt: row.learnedAt.toISOString(),
    lastConfirmedAt: iso(row.lastConfirmedAt) ?? null,
    confidence: row.confidence as MayaConfidence,
    importance: row.importance,
    emotionalWeight: row.emotionalWeight,
    sensitivity: row.sensitivity as MayaMemory["sensitivity"],
    status: row.status.toLowerCase() as MayaMemoryStatus,
    supersededBy: row.supersededBy,
    relatedPeople: row.relatedPeople,
    relatedProjects: row.relatedProjects,
    relatedEvents: row.relatedEvents,
    tags: row.tags,
    provenance: row.provenance as MayaProvenance,
  };
}

function mapPerson(row: Awaited<ReturnType<PrismaLike["mayaPerson"]["findMany"]>>[number]): MayaPerson {
  return {
    personId: row.id,
    ownerId: row.ownerId,
    name: row.name,
    aliases: row.aliases,
    relationshipToOwner: row.relationshipToOwner ?? undefined,
    relevantContext: row.relevantContext ?? undefined,
    importantEventIds: row.importantEventIds,
    projectIds: row.projectIds,
    lastMentioned: iso(row.lastMentioned) ?? null,
    confidence: row.confidence as MayaConfidence,
    status: row.status.toLowerCase() as MayaMemoryStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapProject(row: Awaited<ReturnType<PrismaLike["mayaProject"]["findMany"]>>[number]): MayaProject {
  return {
    projectId: row.id,
    ownerId: row.ownerId,
    name: row.name,
    aliases: row.aliases,
    description: row.description ?? undefined,
    status: row.status.toLowerCase() as MayaProject["status"],
    importantPeople: row.importantPeople,
    currentGoal: row.currentGoal ?? undefined,
    latestUpdate: row.latestUpdate ?? undefined,
    openQuestions: row.openQuestions,
    nextAction: row.nextAction ?? undefined,
    lastUpdated: row.lastUpdated.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

function mapLoop(row: Awaited<ReturnType<PrismaLike["mayaOpenLoop"]["findMany"]>>[number]): MayaOpenLoop {
  return {
    openLoopId: row.id,
    ownerId: row.ownerId,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
    dueAt: iso(row.dueAt) ?? null,
    status: row.status.toLowerCase() as MayaOpenLoop["status"],
    importance: row.importance,
    relatedMemoryId: row.relatedMemoryId,
    lastDiscussed: iso(row.lastDiscussed) ?? null,
  };
}

function mapTimeline(row: Awaited<ReturnType<PrismaLike["mayaTimelineEvent"]["findMany"]>>[number]): MayaTimelineEvent {
  return {
    eventId: row.id,
    ownerId: row.ownerId,
    title: row.title,
    summary: row.summary,
    occurredAt: iso(row.occurredAt) ?? null,
    precision: row.precision as MayaTimelineEvent["precision"],
    memoryIds: row.memoryIds,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapState(row: Awaited<ReturnType<PrismaLike["mayaRelationshipState"]["findMany"]>>[number]): MayaRelationshipState {
  return {
    ownerId: row.ownerId,
    conversationTone: row.conversationTone,
    ownerReportedMood: row.ownerReportedMood,
    interactionIntensity: row.interactionIntensity as MayaRelationshipState["interactionIntensity"],
    affectionContext: row.affectionContext as AffectionMode,
    seriousness: row.seriousness,
    playfulness: row.playfulness,
    unresolvedTension: row.unresolvedTension,
    recentPositiveEvent: row.recentPositiveEvent,
    recentDifficultEvent: row.recentDifficultEvent,
    lastConversationSummary: row.lastConversationSummary,
    unfinishedTopic: row.unfinishedTopic,
    followUpCandidate: row.followUpCandidate,
    languageStyle: row.languageStyle,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapVisual(row: Awaited<ReturnType<PrismaLike["mayaVisualAsset"]["findMany"]>>[number]): MayaVisualAsset {
  return {
    assetId: row.id,
    ownerId: row.ownerId,
    kind: row.kind.toLowerCase() as MayaVisualAsset["kind"],
    path: row.path,
    note: row.note ?? undefined,
    immutable: row.immutable,
    createdAt: row.createdAt.toISOString(),
  };
}

export function emptyPersistentSnapshot() {
  return emptySnapshot();
}
