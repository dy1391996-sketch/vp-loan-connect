import type {
  MayaConversation,
  MayaMemory,
  MayaMemoryStatus,
  MayaMessage,
  MayaOpenLoop,
  MayaOwnerRecord,
  MayaPerson,
  MayaProject,
  MayaRelationshipState,
  MayaSession,
  MayaTimelineEvent,
  MayaVisualAsset,
} from "./types";

export interface MayaStoreSnapshot {
  owners: MayaOwnerRecord[];
  sessions: MayaSession[];
  conversations: MayaConversation[];
  messages: MayaMessage[];
  memories: MayaMemory[];
  people: MayaPerson[];
  projects: MayaProject[];
  openLoops: MayaOpenLoop[];
  timeline: MayaTimelineEvent[];
  relationshipState: MayaRelationshipState[];
  visualAssets: MayaVisualAsset[];
}

export function emptySnapshot(): MayaStoreSnapshot {
  return {
    owners: [],
    sessions: [],
    conversations: [],
    messages: [],
    memories: [],
    people: [],
    projects: [],
    openLoops: [],
    timeline: [],
    relationshipState: [],
    visualAssets: [],
  };
}

export interface MemoryQuery {
  ownerId: string;
  types?: MayaMemory["type"][];
  status?: MayaMemoryStatus[];
  text?: string;
  tags?: string[];
  includeDeleted?: boolean;
  limit?: number;
}

export interface MayaStore {
  snapshot(): MayaStoreSnapshot;
  loadSnapshot(snapshot: MayaStoreSnapshot): void;

  getOwner(ownerId: string): MayaOwnerRecord | undefined;
  getOwnerByEmail(email: string): MayaOwnerRecord | undefined;
  upsertOwner(owner: MayaOwnerRecord): MayaOwnerRecord;
  listOwners(): MayaOwnerRecord[];

  createSession(session: MayaSession): MayaSession;
  getSessionByTokenHash(tokenHash: string): MayaSession | undefined;
  revokeSession(sessionId: string, at: string): void;

  createConversation(conversation: MayaConversation): MayaConversation;
  getConversation(ownerId: string, conversationId: string): MayaConversation | undefined;
  listConversations(ownerId: string): MayaConversation[];
  updateConversation(ownerId: string, conversationId: string, patch: Partial<MayaConversation>): MayaConversation;

  addMessage(message: MayaMessage): MayaMessage;
  listMessages(ownerId: string, conversationId: string, limit?: number): MayaMessage[];

  addMemory(memory: MayaMemory): MayaMemory;
  getMemory(ownerId: string, memoryId: string): MayaMemory | undefined;
  updateMemory(ownerId: string, memoryId: string, patch: Partial<MayaMemory>): MayaMemory;
  listMemories(query: MemoryQuery): MayaMemory[];
  deleteMemory(ownerId: string, memoryId: string, at: string): MayaMemory;

  upsertPerson(person: MayaPerson): MayaPerson;
  getPerson(ownerId: string, personId: string): MayaPerson | undefined;
  listPeople(ownerId: string): MayaPerson[];
  findPersonByName(ownerId: string, name: string): MayaPerson | undefined;

  upsertProject(project: MayaProject): MayaProject;
  getProject(ownerId: string, projectId: string): MayaProject | undefined;
  listProjects(ownerId: string): MayaProject[];
  findProjectByName(ownerId: string, name: string): MayaProject | undefined;

  upsertOpenLoop(loop: MayaOpenLoop): MayaOpenLoop;
  listOpenLoops(ownerId: string, status?: MayaOpenLoop["status"][]): MayaOpenLoop[];
  updateOpenLoop(ownerId: string, openLoopId: string, patch: Partial<MayaOpenLoop>): MayaOpenLoop;

  addTimelineEvent(event: MayaTimelineEvent): MayaTimelineEvent;
  listTimeline(ownerId: string): MayaTimelineEvent[];

  getRelationshipState(ownerId: string): MayaRelationshipState | undefined;
  saveRelationshipState(state: MayaRelationshipState): MayaRelationshipState;

  upsertVisualAsset(asset: MayaVisualAsset): MayaVisualAsset;
  listVisualAssets(ownerId: string): MayaVisualAsset[];
}

function scoped<T extends { ownerId: string }>(ownerId: string, rows: T[]) {
  return rows.filter((row) => row.ownerId === ownerId);
}

export class InMemoryMayaStore implements MayaStore {
  constructor(private data: MayaStoreSnapshot = emptySnapshot()) {}

  snapshot(): MayaStoreSnapshot {
    return structuredClone(this.data);
  }

  loadSnapshot(snapshot: MayaStoreSnapshot) {
    this.data = structuredClone(snapshot);
  }

  getOwner(ownerId: string) {
    return this.data.owners.find((row) => row.ownerId === ownerId);
  }

  getOwnerByEmail(email: string) {
    return this.data.owners.find((row) => row.email.toLowerCase() === email.toLowerCase());
  }

  upsertOwner(owner: MayaOwnerRecord) {
    const index = this.data.owners.findIndex((row) => row.ownerId === owner.ownerId);
    if (index >= 0) this.data.owners[index] = owner;
    else this.data.owners.push(owner);
    return owner;
  }

  listOwners() {
    return [...this.data.owners];
  }

  createSession(session: MayaSession) {
    this.data.sessions.push(session);
    return session;
  }

  getSessionByTokenHash(tokenHash: string) {
    return this.data.sessions.find((row) => row.tokenHash === tokenHash && !row.revokedAt);
  }

  revokeSession(sessionId: string, at: string) {
    const session = this.data.sessions.find((row) => row.sessionId === sessionId);
    if (session) session.revokedAt = at;
  }

  createConversation(conversation: MayaConversation) {
    this.data.conversations.push(conversation);
    return conversation;
  }

  getConversation(ownerId: string, conversationId: string) {
    return scoped(ownerId, this.data.conversations).find((row) => row.conversationId === conversationId);
  }

  listConversations(ownerId: string) {
    return scoped(ownerId, this.data.conversations).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  updateConversation(ownerId: string, conversationId: string, patch: Partial<MayaConversation>) {
    const conversation = this.getConversation(ownerId, conversationId);
    if (!conversation) throw new Error("CONVERSATION_NOT_FOUND");
    Object.assign(conversation, patch);
    return conversation;
  }

  addMessage(message: MayaMessage) {
    this.data.messages.push(message);
    return message;
  }

  listMessages(ownerId: string, conversationId: string, limit = 50) {
    return scoped(ownerId, this.data.messages)
      .filter((row) => row.conversationId === conversationId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(-limit);
  }

  addMemory(memory: MayaMemory) {
    this.data.memories.push(memory);
    return memory;
  }

  getMemory(ownerId: string, memoryId: string) {
    return scoped(ownerId, this.data.memories).find((row) => row.memoryId === memoryId);
  }

  updateMemory(ownerId: string, memoryId: string, patch: Partial<MayaMemory>) {
    const memory = this.getMemory(ownerId, memoryId);
    if (!memory) throw new Error("MEMORY_NOT_FOUND");
    Object.assign(memory, patch);
    return memory;
  }

  listMemories(query: MemoryQuery) {
    const statuses = query.status ?? (query.includeDeleted ? undefined : ["active", "uncertain"]);
    return scoped(query.ownerId, this.data.memories)
      .filter((row) => (query.types ? query.types.includes(row.type) : true))
      .filter((row) => (statuses ? statuses.includes(row.status) : true))
      .filter((row) => (query.tags?.length ? query.tags.some((tag) => row.tags.includes(tag)) : true))
      .filter((row) => {
        if (!query.text) return true;
        const haystack = `${row.content} ${row.normalizedFact ?? ""} ${row.tags.join(" ")}`.toLowerCase();
        return haystack.includes(query.text.toLowerCase());
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, query.limit ?? 200);
  }

  deleteMemory(ownerId: string, memoryId: string, at: string) {
    return this.updateMemory(ownerId, memoryId, { status: "deleted", lastConfirmedAt: at });
  }

  upsertPerson(person: MayaPerson) {
    const index = this.data.people.findIndex((row) => row.ownerId === person.ownerId && row.personId === person.personId);
    if (index >= 0) this.data.people[index] = person;
    else this.data.people.push(person);
    return person;
  }

  getPerson(ownerId: string, personId: string) {
    return scoped(ownerId, this.data.people).find((row) => row.personId === personId);
  }

  listPeople(ownerId: string) {
    return scoped(ownerId, this.data.people).filter((row) => row.status !== "deleted");
  }

  findPersonByName(ownerId: string, name: string) {
    const needle = normalizeName(name);
    return this.listPeople(ownerId).find((row) => normalizeName(row.name) === needle || row.aliases.some((alias) => normalizeName(alias) === needle));
  }

  upsertProject(project: MayaProject) {
    const index = this.data.projects.findIndex((row) => row.ownerId === project.ownerId && row.projectId === project.projectId);
    if (index >= 0) this.data.projects[index] = project;
    else this.data.projects.push(project);
    return project;
  }

  getProject(ownerId: string, projectId: string) {
    return scoped(ownerId, this.data.projects).find((row) => row.projectId === projectId);
  }

  listProjects(ownerId: string) {
    return scoped(ownerId, this.data.projects);
  }

  findProjectByName(ownerId: string, name: string) {
    const needle = normalizeName(name);
    return this.listProjects(ownerId).find((row) => normalizeName(row.name) === needle || row.aliases.some((alias) => normalizeName(alias) === needle));
  }

  upsertOpenLoop(loop: MayaOpenLoop) {
    const index = this.data.openLoops.findIndex((row) => row.ownerId === loop.ownerId && row.openLoopId === loop.openLoopId);
    if (index >= 0) this.data.openLoops[index] = loop;
    else this.data.openLoops.push(loop);
    return loop;
  }

  listOpenLoops(ownerId: string, status?: MayaOpenLoop["status"][]) {
    return scoped(ownerId, this.data.openLoops).filter((row) => (status ? status.includes(row.status) : true));
  }

  updateOpenLoop(ownerId: string, openLoopId: string, patch: Partial<MayaOpenLoop>) {
    const loop = this.listOpenLoops(ownerId).find((row) => row.openLoopId === openLoopId);
    if (!loop) throw new Error("OPEN_LOOP_NOT_FOUND");
    Object.assign(loop, patch);
    return loop;
  }

  addTimelineEvent(event: MayaTimelineEvent) {
    this.data.timeline.push(event);
    return event;
  }

  listTimeline(ownerId: string) {
    return scoped(ownerId, this.data.timeline).sort((a, b) => (b.occurredAt ?? b.createdAt).localeCompare(a.occurredAt ?? a.createdAt));
  }

  getRelationshipState(ownerId: string) {
    return this.data.relationshipState.find((row) => row.ownerId === ownerId);
  }

  saveRelationshipState(state: MayaRelationshipState) {
    const index = this.data.relationshipState.findIndex((row) => row.ownerId === state.ownerId);
    if (index >= 0) this.data.relationshipState[index] = state;
    else this.data.relationshipState.push(state);
    return state;
  }

  upsertVisualAsset(asset: MayaVisualAsset) {
    const existing = this.data.visualAssets.find((row) => row.assetId === asset.assetId && row.ownerId === asset.ownerId);
    if (existing?.immutable && existing.kind === "master") {
      throw new Error("MASTER_MAYA_IMMUTABLE");
    }
    const index = this.data.visualAssets.findIndex((row) => row.assetId === asset.assetId);
    if (index >= 0) {
      if (this.data.visualAssets[index].immutable) throw new Error("MASTER_MAYA_IMMUTABLE");
      this.data.visualAssets[index] = asset;
    } else this.data.visualAssets.push(asset);
    return asset;
  }

  listVisualAssets(ownerId: string) {
    return scoped(ownerId, this.data.visualAssets);
  }
}

export function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function newId() {
  return crypto.randomUUID();
}

export function nowIso(now?: Date) {
  return (now ?? new Date()).toISOString();
}
