export const MAYA_IDENTITY_VERSION = "1.0.0";

export type MayaChannel = "web" | "instagram" | "voice" | "mobile" | "desktop" | "system";

export type MayaMemoryType =
  | "WORKING"
  | "EPISODIC"
  | "SEMANTIC"
  | "PEOPLE"
  | "PROJECT"
  | "PREFERENCE"
  | "RELATIONSHIP"
  | "COMMITMENT"
  | "EMOTIONAL"
  | "CONVERSATION_SUMMARY"
  | "TIMELINE"
  | "CORRECTION";

export type MayaMemoryStatus = "active" | "uncertain" | "superseded" | "corrected" | "archived" | "deleted";

export type MayaProvenance =
  | "REAL_USER_REPORTED"
  | "REAL_CONVERSATION"
  | "INFERENCE"
  | "ROLEPLAY"
  | "FICTION"
  | "SYSTEM_SEED";

export type MayaConfidence = "KNOWN" | "LIKELY" | "UNCERTAIN" | "UNKNOWN";

export type MayaLoopStatus = "open" | "waiting" | "done" | "dropped";

export type MayaProjectStatus = "active" | "paused" | "completed" | "dropped" | "unknown";

export type AffectionMode =
  | "gentle"
  | "playful"
  | "romantic"
  | "teasing"
  | "comforting"
  | "proud"
  | "quiet"
  | "serious";

export interface MayaMemory {
  memoryId: string;
  ownerId: string;
  type: MayaMemoryType;
  subtype?: string;
  content: string;
  normalizedFact?: string;
  sourceConversationId?: string;
  sourceMessageId?: string;
  createdAt: string;
  eventTime?: string | null;
  eventTimePrecision: "exact" | "approximate" | "unknown";
  learnedAt: string;
  lastConfirmedAt?: string | null;
  confidence: MayaConfidence;
  importance: number;
  emotionalWeight: number;
  sensitivity: "normal" | "sensitive" | "private";
  status: MayaMemoryStatus;
  supersededBy?: string | null;
  relatedPeople: string[];
  relatedProjects: string[];
  relatedEvents: string[];
  tags: string[];
  provenance: MayaProvenance;
}

export interface MayaPerson {
  personId: string;
  ownerId: string;
  name: string;
  aliases: string[];
  relationshipToOwner?: string;
  relevantContext?: string;
  importantEventIds: string[];
  projectIds: string[];
  lastMentioned?: string | null;
  confidence: MayaConfidence;
  status: MayaMemoryStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MayaProject {
  projectId: string;
  ownerId: string;
  name: string;
  aliases: string[];
  description?: string;
  status: MayaProjectStatus;
  importantPeople: string[];
  currentGoal?: string;
  latestUpdate?: string;
  openQuestions: string[];
  nextAction?: string;
  lastUpdated: string;
  createdAt: string;
}

export interface MayaOpenLoop {
  openLoopId: string;
  ownerId: string;
  description: string;
  createdAt: string;
  dueAt?: string | null;
  status: MayaLoopStatus;
  importance: number;
  relatedMemoryId?: string | null;
  lastDiscussed?: string | null;
}

export interface MayaTimelineEvent {
  eventId: string;
  ownerId: string;
  title: string;
  summary: string;
  occurredAt?: string | null;
  precision: "exact" | "approximate" | "unknown";
  memoryIds: string[];
  createdAt: string;
}

export interface MayaMessage {
  messageId: string;
  conversationId: string;
  ownerId: string;
  role: "owner" | "maya" | "system";
  channel: MayaChannel;
  text: string;
  createdAt: string;
  roleplay: boolean;
}

export interface MayaConversation {
  conversationId: string;
  ownerId: string;
  channel: MayaChannel;
  title?: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string | null;
  roleplayActive: boolean;
}

export interface MayaRelationshipState {
  ownerId: string;
  conversationTone: string;
  ownerReportedMood?: string | null;
  interactionIntensity: "low" | "medium" | "high";
  affectionContext: AffectionMode;
  seriousness: number;
  playfulness: number;
  unresolvedTension?: string | null;
  recentPositiveEvent?: string | null;
  recentDifficultEvent?: string | null;
  lastConversationSummary?: string | null;
  unfinishedTopic?: string | null;
  followUpCandidate?: string | null;
  languageStyle: string;
  updatedAt: string;
}

export interface MayaOwnerRecord {
  ownerId: string;
  email: string;
  passwordHash: string;
  displayName?: string;
  instagramAccountIds: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MayaSession {
  sessionId: string;
  ownerId: string;
  tokenHash: string;
  expiresAt: string;
  revokedAt?: string | null;
  createdAt: string;
}

export interface MayaVisualAsset {
  assetId: string;
  ownerId: string;
  kind: "master" | "approved" | "rejected";
  path: string;
  note?: string;
  immutable: boolean;
  createdAt: string;
}

export interface RetrievedMemory {
  memory: MayaMemory;
  score: number;
  reasons: string[];
}

export interface WriteDecision {
  stored: boolean;
  reason: string;
  memoryIds: string[];
  duplicateOf?: string;
  contradicted?: string;
  roleplayBlocked: boolean;
}

export interface MayaDebugInfo {
  retrievedMemoryIds: string[];
  retrievalScores: Array<{ memoryId: string; score: number; reasons: string[] }>;
  contextSource: string[];
  writeDecisions: WriteDecision[];
  conflictDecisions: string[];
  modelProvider: string;
  latencyMs: number;
  phaseMs?: {
    writePipeline?: number;
    compile?: number;
    model?: number;
    groundPersist?: number;
  };
  usage?: {
    promptEvalCount?: number;
    evalCount?: number;
    totalDurationMs?: number;
    loadDurationMs?: number;
    promptEvalDurationMs?: number;
    evalDurationMs?: number;
  };
}

export interface MayaTurnResult {
  conversationId: string;
  messageId: string;
  text: string;
  ownerAuthorized: boolean;
  debug?: MayaDebugInfo;
}

export interface CompiledContext {
  system: string;
  memories: MayaMemory[];
  people: MayaPerson[];
  projects: MayaProject[];
  openLoops: MayaOpenLoop[];
  relationshipState: MayaRelationshipState;
  recentMessages: MayaMessage[];
  channel: MayaChannel;
  ownerAuthorized: boolean;
}

export interface MayaSeedDocument {
  version: string;
  source: "SYSTEM_SEED";
  ownerHistoryStatus?: "not-provided" | "verified-partial" | "verified";
  importPolicy?: string;
  ownerProfile?: {
    displayName?: string;
    preferredLanguage?: string;
    communicationStyle?: string;
    notes?: string;
  };
  relationshipContextFacts?: Array<{
    category: string;
    content: string;
    confidence?: MayaConfidence;
    importance?: number;
    verified?: boolean;
  }>;
  people?: Array<{ name: string; aliases?: string[]; relationshipToOwner?: string; relevantContext?: string; confidence?: MayaConfidence; verified?: boolean }>;
  projects?: Array<{ name: string; aliases?: string[]; description?: string; status?: MayaProjectStatus; currentGoal?: string; verified?: boolean }>;
  preferences?: Array<{ content: string; confidence?: MayaConfidence; verified?: boolean }>;
  events?: Array<{ content: string; occurredAt?: string; precision?: "exact" | "approximate" | "unknown"; confidence?: MayaConfidence; verified?: boolean }>;
  ongoingMatters?: Array<{ content: string; importance?: number; verified?: boolean }>;
  communicationStyle?: { languages?: string[]; emojiComfort?: string; formality?: string };
}

export const HISTORICAL_PROVENANCE: MayaProvenance[] = ["REAL_USER_REPORTED", "REAL_CONVERSATION", "SYSTEM_SEED"];
export const FICTIONAL_PROVENANCE: MayaProvenance[] = ["ROLEPLAY", "FICTION"];
