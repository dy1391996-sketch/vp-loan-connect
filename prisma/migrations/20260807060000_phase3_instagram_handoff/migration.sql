-- CreateEnum
CREATE TYPE "HandoffStatus" AS ENUM ('CREATED', 'CLICKED', 'CONSUMED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "IdentityLinkStatus" AS ENUM ('UNLINKED', 'POSSIBLE_MATCH', 'ATTRIBUTED_HANDOFF', 'VERIFIED_MATCH');

-- CreateEnum
CREATE TYPE "ProviderSendStatus" AS ENUM ('SENT', 'QUEUED', 'FAILED', 'SKIPPED_PROVIDER_UNAVAILABLE', 'SKIPPED_POLICY');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CommentCategory" ADD VALUE 'GENERAL';
ALTER TYPE "CommentCategory" ADD VALUE 'HUMAN_REQUEST';

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "attributionPath" TEXT,
ADD COLUMN     "linkedFromConversationId" TEXT,
ADD COLUMN     "sourceCommentId" TEXT,
ADD COLUMN     "sourceMediaId" TEXT;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "providerSendStatus" "ProviderSendStatus",
ADD COLUMN     "replyToExternalId" TEXT;

-- CreateTable
CREATE TABLE "ChannelHandoff" (
    "id" TEXT NOT NULL,
    "publicRef" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "sourceChannel" "ChannelType" NOT NULL,
    "sourceConversationId" TEXT,
    "sourceMessageId" TEXT,
    "sourceCommentId" TEXT,
    "sourceLeadId" TEXT,
    "sourceCustomerId" TEXT,
    "destinationChannel" "ChannelType" NOT NULL DEFAULT 'WHATSAPP',
    "destinationConversationId" TEXT,
    "destinationCustomerId" TEXT,
    "destinationPhoneE164" TEXT,
    "status" "HandoffStatus" NOT NULL DEFAULT 'CREATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "clickedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "metadata" JSONB,

    CONSTRAINT "ChannelHandoff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentityLink" (
    "id" TEXT NOT NULL,
    "customerAId" TEXT NOT NULL,
    "customerBId" TEXT NOT NULL,
    "status" "IdentityLinkStatus" NOT NULL DEFAULT 'POSSIBLE_MATCH',
    "method" TEXT NOT NULL,
    "handoffId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "IdentityLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChannelHandoff_publicRef_key" ON "ChannelHandoff"("publicRef");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelHandoff_tokenHash_key" ON "ChannelHandoff"("tokenHash");

-- CreateIndex
CREATE INDEX "ChannelHandoff_status_expiresAt_idx" ON "ChannelHandoff"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "ChannelHandoff_sourceLeadId_idx" ON "ChannelHandoff"("sourceLeadId");

-- CreateIndex
CREATE INDEX "ChannelHandoff_sourceConversationId_idx" ON "ChannelHandoff"("sourceConversationId");

-- CreateIndex
CREATE INDEX "IdentityLink_status_idx" ON "IdentityLink"("status");

-- CreateIndex
CREATE UNIQUE INDEX "IdentityLink_customerAId_customerBId_key" ON "IdentityLink"("customerAId", "customerBId");

-- CreateIndex
CREATE INDEX "Conversation_channel_idx" ON "Conversation"("channel");

-- CreateIndex
CREATE INDEX "Conversation_linkedFromConversationId_idx" ON "Conversation"("linkedFromConversationId");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_linkedFromConversationId_fkey" FOREIGN KEY ("linkedFromConversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelHandoff" ADD CONSTRAINT "ChannelHandoff_sourceConversationId_fkey" FOREIGN KEY ("sourceConversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelHandoff" ADD CONSTRAINT "ChannelHandoff_destinationConversationId_fkey" FOREIGN KEY ("destinationConversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelHandoff" ADD CONSTRAINT "ChannelHandoff_sourceCustomerId_fkey" FOREIGN KEY ("sourceCustomerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelHandoff" ADD CONSTRAINT "ChannelHandoff_destinationCustomerId_fkey" FOREIGN KEY ("destinationCustomerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityLink" ADD CONSTRAINT "IdentityLink_customerAId_fkey" FOREIGN KEY ("customerAId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityLink" ADD CONSTRAINT "IdentityLink_customerBId_fkey" FOREIGN KEY ("customerBId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

