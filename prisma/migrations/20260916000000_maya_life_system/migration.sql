-- Additive Maya Life System tables. Does not drop or rewrite Lead, Order, Payment, or other VP Loan Connect data.

-- CreateEnum
CREATE TYPE "MayaMemoryType" AS ENUM ('WORKING', 'EPISODIC', 'SEMANTIC', 'PEOPLE', 'PROJECT', 'PREFERENCE', 'RELATIONSHIP', 'COMMITMENT', 'EMOTIONAL', 'CONVERSATION_SUMMARY', 'TIMELINE', 'CORRECTION');

-- CreateEnum
CREATE TYPE "MayaMemoryStatus" AS ENUM ('ACTIVE', 'UNCERTAIN', 'SUPERSEDED', 'CORRECTED', 'ARCHIVED', 'DELETED');

-- CreateEnum
CREATE TYPE "MayaProvenance" AS ENUM ('REAL_USER_REPORTED', 'REAL_CONVERSATION', 'INFERENCE', 'ROLEPLAY', 'FICTION', 'SYSTEM_SEED');

-- CreateEnum
CREATE TYPE "MayaConfidence" AS ENUM ('KNOWN', 'LIKELY', 'UNCERTAIN', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "MayaChannelKind" AS ENUM ('WEB', 'INSTAGRAM', 'VOICE', 'MOBILE', 'DESKTOP', 'SYSTEM');

-- CreateEnum
CREATE TYPE "MayaLoopStatus" AS ENUM ('OPEN', 'WAITING', 'DONE', 'DROPPED');

-- CreateEnum
CREATE TYPE "MayaProjectStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'DROPPED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "MayaVisualKind" AS ENUM ('MASTER', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "maya_owners" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT,
    "instagramAccountIds" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maya_owners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maya_owner_sessions" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maya_owner_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maya_conversations" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "channel" "MayaChannelKind" NOT NULL DEFAULT 'WEB',
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "roleplayActive" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "maya_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maya_messages" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "channel" "MayaChannelKind" NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "roleplay" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "maya_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maya_memories" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "type" "MayaMemoryType" NOT NULL,
    "subtype" TEXT,
    "content" TEXT NOT NULL,
    "normalizedFact" TEXT,
    "sourceConversationId" UUID,
    "sourceMessageId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventTime" TIMESTAMP(3),
    "eventTimePrecision" TEXT NOT NULL DEFAULT 'unknown',
    "learnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastConfirmedAt" TIMESTAMP(3),
    "confidence" "MayaConfidence" NOT NULL DEFAULT 'KNOWN',
    "importance" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "emotionalWeight" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sensitivity" TEXT NOT NULL DEFAULT 'normal',
    "status" "MayaMemoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "supersededBy" UUID,
    "relatedPeople" TEXT[],
    "relatedProjects" TEXT[],
    "relatedEvents" TEXT[],
    "tags" TEXT[],
    "provenance" "MayaProvenance" NOT NULL,

    CONSTRAINT "maya_memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maya_people" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT[],
    "relationshipToOwner" TEXT,
    "relevantContext" TEXT,
    "importantEventIds" TEXT[],
    "projectIds" TEXT[],
    "lastMentioned" TIMESTAMP(3),
    "confidence" "MayaConfidence" NOT NULL DEFAULT 'KNOWN',
    "status" "MayaMemoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maya_people_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maya_projects" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT[],
    "description" TEXT,
    "status" "MayaProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "importantPeople" TEXT[],
    "currentGoal" TEXT,
    "latestUpdate" TEXT,
    "openQuestions" TEXT[],
    "nextAction" TEXT,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maya_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maya_open_loops" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3),
    "status" "MayaLoopStatus" NOT NULL DEFAULT 'OPEN',
    "importance" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "relatedMemoryId" UUID,
    "lastDiscussed" TIMESTAMP(3),

    CONSTRAINT "maya_open_loops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maya_timeline_events" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3),
    "precision" TEXT NOT NULL DEFAULT 'unknown',
    "memoryIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maya_timeline_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maya_relationship_state" (
    "ownerId" UUID NOT NULL,
    "conversationTone" TEXT NOT NULL DEFAULT 'warm',
    "ownerReportedMood" TEXT,
    "interactionIntensity" TEXT NOT NULL DEFAULT 'medium',
    "affectionContext" TEXT NOT NULL DEFAULT 'gentle',
    "seriousness" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "playfulness" DOUBLE PRECISION NOT NULL DEFAULT 0.4,
    "unresolvedTension" TEXT,
    "recentPositiveEvent" TEXT,
    "recentDifficultEvent" TEXT,
    "lastConversationSummary" TEXT,
    "unfinishedTopic" TEXT,
    "followUpCandidate" TEXT,
    "languageStyle" TEXT NOT NULL DEFAULT 'hinglish',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maya_relationship_state_pkey" PRIMARY KEY ("ownerId")
);

-- CreateTable
CREATE TABLE "maya_visual_assets" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "kind" "MayaVisualKind" NOT NULL,
    "path" TEXT NOT NULL,
    "note" TEXT,
    "immutable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maya_visual_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "maya_owners_email_key" ON "maya_owners"("email");

-- CreateIndex
CREATE UNIQUE INDEX "maya_owner_sessions_tokenHash_key" ON "maya_owner_sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "maya_owner_sessions_ownerId_expiresAt_idx" ON "maya_owner_sessions"("ownerId", "expiresAt");

-- CreateIndex
CREATE INDEX "maya_conversations_ownerId_updatedAt_idx" ON "maya_conversations"("ownerId", "updatedAt");

-- CreateIndex
CREATE INDEX "maya_messages_ownerId_conversationId_createdAt_idx" ON "maya_messages"("ownerId", "conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "maya_memories_ownerId_type_status_idx" ON "maya_memories"("ownerId", "type", "status");

-- CreateIndex
CREATE INDEX "maya_memories_ownerId_createdAt_idx" ON "maya_memories"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "maya_people_ownerId_name_idx" ON "maya_people"("ownerId", "name");

-- CreateIndex
CREATE INDEX "maya_projects_ownerId_status_idx" ON "maya_projects"("ownerId", "status");

-- CreateIndex
CREATE INDEX "maya_open_loops_ownerId_status_idx" ON "maya_open_loops"("ownerId", "status");

-- CreateIndex
CREATE INDEX "maya_timeline_events_ownerId_createdAt_idx" ON "maya_timeline_events"("ownerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "maya_visual_assets_ownerId_kind_path_key" ON "maya_visual_assets"("ownerId", "kind", "path");

-- AddForeignKey
ALTER TABLE "maya_owner_sessions" ADD CONSTRAINT "maya_owner_sessions_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "maya_owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maya_conversations" ADD CONSTRAINT "maya_conversations_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "maya_owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maya_messages" ADD CONSTRAINT "maya_messages_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "maya_owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maya_messages" ADD CONSTRAINT "maya_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "maya_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maya_memories" ADD CONSTRAINT "maya_memories_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "maya_owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maya_people" ADD CONSTRAINT "maya_people_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "maya_owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maya_projects" ADD CONSTRAINT "maya_projects_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "maya_owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maya_open_loops" ADD CONSTRAINT "maya_open_loops_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "maya_owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maya_timeline_events" ADD CONSTRAINT "maya_timeline_events_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "maya_owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maya_relationship_state" ADD CONSTRAINT "maya_relationship_state_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "maya_owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maya_visual_assets" ADD CONSTRAINT "maya_visual_assets_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "maya_owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

