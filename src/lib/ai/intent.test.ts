import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectIntent, requiresHumanHandover } from "@/lib/ai/intent";
import { detectLanguage } from "@/lib/ai/language";
import { extractBookingSlots, missingSlotQuestion, mergeSlots } from "@/lib/ai/slots";
import { parseWhatsAppWebhookPayload } from "@/lib/whatsapp/inbound";

describe("intent detection", () => {
  it("detects price and handover intents", () => {
    assert.equal(detectIntent("24 hour price?").intent, "price_enquiry");
    assert.equal(detectIntent("I want a human agent").intent, "human_support");
    assert.equal(detectIntent("please refund my money").intent, "refund_request");
    assert.equal(detectIntent("STOP").intent, "opt_out");
  });

  it("flags handover for complaints and low confidence unknown", () => {
    assert.equal(requiresHumanHandover("complaint", "this is dirty and fraud", 0.9), true);
    assert.equal(requiresHumanHandover("unknown", "asdf", 0.2), true);
    assert.equal(requiresHumanHandover("price_enquiry", "price?", 0.9), false);
  });
});

describe("language detection", () => {
  it("detects en / hi / hinglish", () => {
    assert.equal(detectLanguage("What is the price?"), "EN");
    assert.equal(detectLanguage("किराया कितना है"), "HI");
    assert.equal(detectLanguage("Kitna charge hai bhai"), "HINGLISH");
  });
});

describe("slot extraction", () => {
  it("extracts tomorrow 24h couple stay", () => {
    const slots = extractBookingSlots("Tomorrow 24 hour for couple, balcony", new Date("2026-08-02T10:00:00Z"));
    assert.equal(slots.requiredDate, "2026-08-03");
    assert.equal(slots.durationHours, 24);
    assert.equal(slots.guestCount, 2);
    assert.equal(slots.preferBalcony, true);
  });

  it("asks one missing question at a time", () => {
    const q1 = missingSlotQuestion({}, "EN");
    assert.match(q1 ?? "", /date/i);
    const q2 = missingSlotQuestion({ requiredDate: "2026-08-03" }, "EN");
    assert.match(q2 ?? "", /check-in/i);
  });

  it("merges slots without wiping known values", () => {
    const merged = mergeSlots({ requiredDate: "2026-08-03", guestCount: 2 }, { durationHours: 12 });
    assert.equal(merged.requiredDate, "2026-08-03");
    assert.equal(merged.durationHours, 12);
    assert.equal(merged.guestCount, 2);
  });
});

describe("whatsapp webhook parsing", () => {
  it("parses cloud api message payloads", () => {
    const parsed = parseWhatsAppWebhookPayload({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "WABA",
          changes: [
            {
              value: {
                contacts: [{ profile: { name: "Riya" }, wa_id: "919811122233" }],
                messages: [
                  {
                    id: "wamid.TEST1",
                    from: "919811122233",
                    timestamp: "1710000000",
                    type: "text",
                    text: { body: "Price for today?" },
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].text, "Price for today?");
    assert.equal(parsed[0].profileName, "Riya");
  });
});
