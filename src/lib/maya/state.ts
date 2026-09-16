import type { MayaRelationshipState } from "./types";

export function defaultRelationshipState(ownerId: string, at: string): MayaRelationshipState {
  return {
    ownerId,
    conversationTone: "warm",
    ownerReportedMood: null,
    interactionIntensity: "medium",
    affectionContext: "gentle",
    seriousness: 0.3,
    playfulness: 0.4,
    unresolvedTension: null,
    recentPositiveEvent: null,
    recentDifficultEvent: null,
    lastConversationSummary: null,
    unfinishedTopic: null,
    followUpCandidate: null,
    languageStyle: "hinglish",
    updatedAt: at,
  };
}
