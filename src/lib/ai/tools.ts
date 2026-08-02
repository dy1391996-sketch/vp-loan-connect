import { z } from "zod";
import { searchAvailableStudios } from "@/lib/domain/availability";
import { calculateBookingPrice } from "@/lib/domain/pricing";
import { createTemporaryHold, releaseTemporaryHold } from "@/lib/domain/holds";
import { createBookingDraft, generateBookingPaymentLink, confirmBookingFromPayment } from "@/lib/domain/bookings";
import { createOrUpdateLead } from "@/lib/domain/leads";
import { prisma } from "@/lib/db";
import { addHours } from "@/lib/utils";

/**
 * Validated AI tool registry — the model never touches the DB directly.
 */
export const AI_TOOL_NAMES = [
  "searchAvailableStudios",
  "calculateBookingPrice",
  "getStudioDetails",
  "getStudioMedia",
  "createLead",
  "updateLead",
  "createTemporaryHold",
  "releaseTemporaryHold",
  "createBooking",
  "generatePaymentLink",
  "verifyPayment",
  "sendBookingConfirmation",
  "requestCustomerID",
  "createSupportTicket",
  "assignHumanAgent",
  "scheduleFollowUp",
  "cancelFollowUp",
  "createCleaningTask",
  "updateCleaningStatus",
  "createContentDraft",
  "scheduleInstagramPost",
  "publishApprovedContent",
  "fetchBusinessAnalytics",
  "generateDailyReport",
  "generateWeeklyReport",
] as const;

export type AIToolName = (typeof AI_TOOL_NAMES)[number];

export async function executeAITool(name: AIToolName, rawArgs: unknown, actorId?: string) {
  const started = Date.now();
  let success = true;
  let output: unknown = null;
  let error: string | undefined;

  try {
    switch (name) {
      case "searchAvailableStudios": {
        const args = z
          .object({
            checkInAt: z.string().datetime(),
            durationHours: z.number().positive(),
            guestCount: z.number().int().positive(),
            preferBalcony: z.boolean().optional(),
            preferJacuzzi: z.boolean().optional(),
            preferPremium: z.boolean().optional(),
          })
          .parse(rawArgs);
        output = await searchAvailableStudios({
          checkInAt: new Date(args.checkInAt),
          durationHours: args.durationHours,
          guestCount: args.guestCount,
          preferBalcony: args.preferBalcony,
          preferJacuzzi: args.preferJacuzzi,
          preferPremium: args.preferPremium,
        });
        break;
      }
      case "calculateBookingPrice": {
        const args = z
          .object({
            checkInAt: z.string().datetime(),
            durationHours: z.number().positive(),
            studioId: z.string().optional(),
            couponCode: z.string().optional(),
            returningCustomer: z.boolean().optional(),
            manualOverrideInr: z.number().optional(),
          })
          .parse(rawArgs);
        output = await calculateBookingPrice({
          checkInAt: new Date(args.checkInAt),
          durationHours: args.durationHours,
          studioId: args.studioId,
          couponCode: args.couponCode,
          returningCustomer: args.returningCustomer,
          manualOverrideInr: args.manualOverrideInr,
        });
        break;
      }
      case "getStudioDetails": {
        const args = z.object({ studioId: z.string() }).parse(rawArgs);
        output = await prisma.studio.findUnique({
          where: { id: args.studioId },
          include: { media: { where: { approved: true }, take: 10 } },
        });
        break;
      }
      case "getStudioMedia": {
        const args = z.object({ studioId: z.string() }).parse(rawArgs);
        output = await prisma.studioMedia.findMany({
          where: { studioId: args.studioId, approved: true, isCurrent: true },
          orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }],
        });
        break;
      }
      case "createLead": {
        const args = z
          .object({
            customerId: z.string(),
            source: z.enum(["WHATSAPP", "INSTAGRAM_DM", "INSTAGRAM_COMMENT", "WEBSITE", "DIRECT", "PHONE", "OTHER"]),
            name: z.string().optional(),
            phone: z.string().optional(),
            requiredDate: z.string().datetime().optional(),
            durationHours: z.number().optional(),
            guestCount: z.number().optional(),
            aiDetectedIntent: z.string().optional(),
          })
          .parse(rawArgs);
        output = await createOrUpdateLead({
          customerId: args.customerId,
          source: args.source,
          name: args.name,
          phone: args.phone,
          requiredDate: args.requiredDate ? new Date(args.requiredDate) : undefined,
          durationHours: args.durationHours,
          guestCount: args.guestCount,
          aiDetectedIntent: args.aiDetectedIntent,
        });
        break;
      }
      case "updateLead": {
        const args = z
          .object({
            leadId: z.string(),
            stage: z.string().optional(),
            summary: z.string().optional(),
            bookingProbability: z.number().int().min(0).max(100).optional(),
          })
          .parse(rawArgs);
        output = await prisma.lead.update({
          where: { id: args.leadId },
          data: {
            stage: args.stage as never,
            conversationSummary: args.summary,
            bookingProbability: args.bookingProbability,
            lastContactAt: new Date(),
          },
        });
        break;
      }
      case "createTemporaryHold": {
        const args = z
          .object({
            studioId: z.string(),
            checkInAt: z.string().datetime(),
            durationHours: z.number().positive(),
            customerId: z.string().optional(),
            leadId: z.string().optional(),
            idempotencyKey: z.string().optional(),
          })
          .parse(rawArgs);
        output = await createTemporaryHold({
          studioId: args.studioId,
          checkInAt: new Date(args.checkInAt),
          durationHours: args.durationHours,
          customerId: args.customerId,
          leadId: args.leadId,
          idempotencyKey: args.idempotencyKey,
          createdById: actorId,
        });
        break;
      }
      case "releaseTemporaryHold": {
        const args = z.object({ holdId: z.string() }).parse(rawArgs);
        output = await releaseTemporaryHold(args.holdId);
        break;
      }
      case "createBooking": {
        const args = z
          .object({
            customerId: z.string(),
            leadId: z.string().optional(),
            studioId: z.string(),
            checkInAt: z.string().datetime(),
            durationHours: z.number().positive(),
            guestCount: z.number().int().positive(),
            couponCode: z.string().optional(),
            idempotencyKey: z.string().optional(),
          })
          .parse(rawArgs);
        output = await createBookingDraft({
          ...args,
          checkInAt: new Date(args.checkInAt),
          createdById: actorId,
        });
        break;
      }
      case "generatePaymentLink": {
        const args = z.object({ bookingId: z.string() }).parse(rawArgs);
        output = await generateBookingPaymentLink(args.bookingId, actorId);
        break;
      }
      case "verifyPayment": {
        const args = z
          .object({
            bookingId: z.string(),
            providerPaymentId: z.string(),
            providerOrderId: z.string().optional(),
            amountInr: z.number(),
          })
          .parse(rawArgs);
        // AI cannot mark paid without webhook path — this only reads status unless already verified server-side flag
        const payment = await prisma.payment.findFirst({
          where: {
            bookingId: args.bookingId,
            status: "PAID",
            OR: [{ providerPaymentId: args.providerPaymentId }, { providerOrderId: args.providerOrderId }],
          },
        });
        if (!payment) {
          output = { verified: false, message: "Payment not verified via webhook yet." };
        } else {
          output = { verified: true, payment, booking: await confirmBookingFromPayment(args) };
        }
        break;
      }
      case "sendBookingConfirmation": {
        const args = z.object({ bookingId: z.string() }).parse(rawArgs);
        const booking = await prisma.booking.findUniqueOrThrow({
          where: { id: args.bookingId },
          include: { studio: true, customer: true },
        });
        if (booking.status !== "CONFIRMED" && booking.status !== "CHECKED_IN") {
          throw new Error("Booking is not confirmed.");
        }
        output = {
          message: `Booking ${booking.reference} confirmed for ${booking.studio.title}. Check-in ${booking.checkInAt.toISOString()}. Location: Gaur City Center, Greater Noida West. Final access details after ID verification.`,
          bookingId: booking.id,
        };
        break;
      }
      case "requestCustomerID": {
        const args = z.object({ bookingId: z.string() }).parse(rawArgs);
        output = await prisma.booking.update({
          where: { id: args.bookingId },
          data: { idRequested: true },
        });
        break;
      }
      case "createSupportTicket": {
        const args = z
          .object({
            subject: z.string(),
            description: z.string(),
            priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
            customerId: z.string().optional(),
            conversationId: z.string().optional(),
            bookingId: z.string().optional(),
          })
          .parse(rawArgs);
        output = await prisma.supportTicket.create({ data: { ...args, createdById: actorId } });
        break;
      }
      case "assignHumanAgent": {
        const args = z
          .object({
            conversationId: z.string(),
            staffId: z.string().optional(),
            pendingAction: z.string().optional(),
            summary: z.string().optional(),
          })
          .parse(rawArgs);
        output = await prisma.conversation.update({
          where: { id: args.conversationId },
          data: {
            status: "HUMAN_HANDOVER",
            aiPaused: true,
            assignedStaffId: args.staffId,
            pendingAction: args.pendingAction,
            summary: args.summary,
            urgent: true,
          },
        });
        break;
      }
      case "scheduleFollowUp": {
        const args = z
          .object({
            customerId: z.string(),
            leadId: z.string().optional(),
            type: z.enum([
              "NO_REPLY_AFTER_PRICE",
              "UNPAID_TOKEN",
              "TODAY_AVAILABILITY",
              "FUTURE_DATE",
              "LOST_PRICE",
              "PAST_CUSTOMER",
              "PRE_ARRIVAL",
              "CHECKOUT",
              "REVIEW",
              "CUSTOM",
            ]),
            scheduledAt: z.string().datetime(),
            templateKey: z.string().optional(),
          })
          .parse(rawArgs);
        output = await prisma.followUp.create({
          data: {
            customerId: args.customerId,
            leadId: args.leadId,
            type: args.type,
            scheduledAt: new Date(args.scheduledAt),
            templateKey: args.templateKey,
            createdById: actorId,
          },
        });
        break;
      }
      case "cancelFollowUp": {
        const args = z.object({ followUpId: z.string(), reason: z.string().optional() }).parse(rawArgs);
        output = await prisma.followUp.update({
          where: { id: args.followUpId },
          data: { status: "CANCELLED", cancelReason: args.reason },
        });
        break;
      }
      case "createCleaningTask": {
        const args = z
          .object({
            studioId: z.string(),
            bookingId: z.string().optional(),
            type: z.enum(["DAILY", "CHECKOUT", "DEEP"]).default("CHECKOUT"),
            checkoutTime: z.string().datetime().optional(),
          })
          .parse(rawArgs);
        output = await prisma.cleaningTask.create({
          data: {
            studioId: args.studioId,
            bookingId: args.bookingId,
            type: args.type,
            checkoutTime: args.checkoutTime ? new Date(args.checkoutTime) : undefined,
            createdById: actorId,
          },
        });
        await prisma.studio.update({
          where: { id: args.studioId },
          data: { cleaningStatus: "DIRTY", availabilityStatus: "CHECKOUT_PENDING" },
        });
        break;
      }
      case "updateCleaningStatus": {
        const args = z
          .object({
            taskId: z.string(),
            status: z.enum(["PENDING", "ASSIGNED", "IN_PROGRESS", "AWAITING_APPROVAL", "APPROVED", "REJECTED"]),
            linenChanged: z.boolean().optional(),
            towelsChanged: z.boolean().optional(),
            bathroomCleaned: z.boolean().optional(),
            amenitiesRefilled: z.boolean().optional(),
            supervisorApproved: z.boolean().optional(),
            studioReady: z.boolean().optional(),
          })
          .parse(rawArgs);
        const task = await prisma.cleaningTask.update({
          where: { id: args.taskId },
          data: {
            status: args.status,
            linenChanged: args.linenChanged,
            towelsChanged: args.towelsChanged,
            bathroomCleaned: args.bathroomCleaned,
            amenitiesRefilled: args.amenitiesRefilled,
            supervisorApproved: args.supervisorApproved,
            studioReady: args.studioReady,
            completionTime: args.status === "APPROVED" ? new Date() : undefined,
          },
        });
        if (args.status === "APPROVED" && args.studioReady) {
          await prisma.studio.update({
            where: { id: task.studioId },
            data: { cleaningStatus: "READY", availabilityStatus: "READY" },
          });
        }
        output = task;
        break;
      }
      case "createContentDraft": {
        const args = z
          .object({
            category: z.string(),
            hook: z.string().optional(),
            caption: z.string().optional(),
            cta: z.string().optional(),
            sensitive: z.boolean().optional(),
          })
          .parse(rawArgs);
        output = await prisma.contentDraft.create({
          data: {
            category: args.category as never,
            hook: args.hook,
            caption: args.caption,
            cta: args.cta,
            sensitive: args.sensitive ?? false,
            requiresApproval: true,
            status: "PENDING_APPROVAL",
            createdById: actorId,
          },
        });
        break;
      }
      case "scheduleInstagramPost": {
        const args = z.object({ draftId: z.string(), scheduledAt: z.string().datetime() }).parse(rawArgs);
        const draft = await prisma.contentDraft.findUniqueOrThrow({ where: { id: args.draftId } });
        if (draft.status !== "APPROVED" && draft.requiresApproval) {
          throw new Error("Content must be approved before scheduling.");
        }
        output = await prisma.contentDraft.update({
          where: { id: args.draftId },
          data: { status: "SCHEDULED", scheduledAt: new Date(args.scheduledAt) },
        });
        break;
      }
      case "publishApprovedContent": {
        const args = z.object({ draftId: z.string() }).parse(rawArgs);
        const draft = await prisma.contentDraft.findUniqueOrThrow({ where: { id: args.draftId } });
        if (draft.sensitive || draft.requiresApproval) {
          if (draft.status !== "APPROVED" && draft.status !== "SCHEDULED") {
            throw new Error("Sensitive or gated content requires approval.");
          }
        }
        output = await prisma.socialPost.create({
          data: {
            draftId: draft.id,
            status: "PUBLISHED",
            publishedAt: new Date(),
            caption: draft.caption,
          },
        });
        await prisma.contentDraft.update({ where: { id: draft.id }, data: { status: "PUBLISHED" } });
        break;
      }
      case "fetchBusinessAnalytics": {
        const [leads, bookings, payments, studios] = await Promise.all([
          prisma.lead.count(),
          prisma.booking.count({ where: { status: { in: ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] } } }),
          prisma.payment.aggregate({ where: { status: "PAID" }, _sum: { amountInr: true } }),
          prisma.studio.findMany({ select: { id: true, availabilityStatus: true } }),
        ]);
        output = {
          leads,
          confirmedBookings: bookings,
          revenueInr: payments._sum.amountInr ?? 0,
          studios,
        };
        break;
      }
      case "generateDailyReport": {
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        const analytics = await executeAITool("fetchBusinessAnalytics", {}, actorId);
        const summary = `Daily snapshot: ${JSON.stringify(analytics.output)}`;
        output = await prisma.dailyReport.upsert({
          where: { reportDate: today },
          create: { reportDate: today, payload: analytics.output as object, summary },
          update: { payload: analytics.output as object, summary },
        });
        break;
      }
      case "generateWeeklyReport": {
        const weekStart = new Date();
        weekStart.setUTCHours(0, 0, 0, 0);
        weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());
        const analytics = await executeAITool("fetchBusinessAnalytics", {}, actorId);
        output = await prisma.weeklyReport.upsert({
          where: { weekStart },
          create: {
            weekStart,
            payload: analytics.output as object,
            summary: "Weekly performance overview",
            actionPlan: "1) Follow hot unpaid tokens\n2) Promote low-occupancy studios\n3) Publish hygiene reel",
          },
          update: { payload: analytics.output as object },
        });
        break;
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (e) {
    success = false;
    error = e instanceof Error ? e.message : "Tool failed";
    output = { error };
  }

  await prisma.aIAction.create({
    data: {
      toolName: name,
      input: rawArgs as object,
      output: output as object,
      success,
      error,
      createdById: actorId,
    },
  });

  return { success, output, error, durationMs: Date.now() - started };
}

// silence unused import for addHours if tree-shaken oddly
void addHours;
