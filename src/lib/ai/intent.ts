export type CustomerIntent =
  | "price_enquiry"
  | "availability_enquiry"
  | "booking_request"
  | "studio_photos"
  | "location_request"
  | "amenities_enquiry"
  | "check_in_enquiry"
  | "check_out_enquiry"
  | "couple_friendly"
  | "id_requirement"
  | "payment_enquiry"
  | "token_payment"
  | "extension_request"
  | "late_checkout"
  | "cancellation"
  | "refund_request"
  | "complaint"
  | "cleaning_request"
  | "wifi_issue"
  | "returning_customer"
  | "corporate_long_stay"
  | "human_support"
  | "opt_out"
  | "spam"
  | "greeting"
  | "provide_details"
  | "select_studio"
  | "unknown";

const PATTERNS: { intent: CustomerIntent; patterns: RegExp[] }[] = [
  { intent: "opt_out", patterns: [/\bstop\b/i, /\bunsubscribe\b/i, /mat bhejo/i, /don't (message|contact)/i] },
  { intent: "human_support", patterns: [/human/i, /agent/i, /call me/i, /speak to/i, /person/i, /manager/i, /बात कर/i, /call karo/i] },
  { intent: "refund_request", patterns: [/refund/i, /paise wapas/i, /money back/i, /रिफंड/i] },
  { intent: "complaint", patterns: [/complaint/i, /dirty/i, /worst/i, /fraud/i, /cheat/i, /police/i, /legal/i, /शिकायत/i] },
  { intent: "cancellation", patterns: [/cancel/i, /रद्द/i] },
  { intent: "token_payment", patterns: [/token/i, /payment link/i, /pay now/i, /paid/i, /payment done/i] },
  { intent: "payment_enquiry", patterns: [/payment/i, /pay/i, /upi/i, /razorpay/i, /advance/i] },
  { intent: "studio_photos", patterns: [/photo/i, /pics?/i, /image/i, /reel/i, /तस्वीर/i, /pic bhejo/i] },
  { intent: "location_request", patterns: [/location/i, /address/i, /kahan/i, /where/i, /map/i, /लोकेशन/i, /पता/i] },
  { intent: "couple_friendly", patterns: [/couple/i, /unmarried/i, /girlfriend/i, /boyfriend/i, /दोनों/i] },
  { intent: "amenities_enquiry", patterns: [/amenit/i, /wifi|wi-fi/i, /ac\b/i, /jacuzzi/i, /balcony/i, /kitchen/i] },
  { intent: "wifi_issue", patterns: [/wifi.*(not|issue|problem|slow)/i, /password.*wifi/i] },
  { intent: "cleaning_request", patterns: [/clean/i, /towel/i, /linen/i, /साफ/i] },
  { intent: "extension_request", patterns: [/extend/i, /extension/i, /extra (hour|time)/i] },
  { intent: "late_checkout", patterns: [/late checkout/i, /checkout late/i] },
  { intent: "check_in_enquiry", patterns: [/check[- ]?in/i, /entry time/i] },
  { intent: "check_out_enquiry", patterns: [/check[- ]?out/i] },
  { intent: "id_requirement", patterns: [/\bid\b/i, /aadhaar|aadhar|pan|passport/i, /government id/i] },
  { intent: "corporate_long_stay", patterns: [/corporate/i, /company/i, /long stay/i, /weekly|monthly/i] },
  { intent: "returning_customer", patterns: [/again/i, /last time/i, /pehle/i, /returning/i, /previous booking/i] },
  { intent: "availability_enquiry", patterns: [/available/i, /availability/i, /khali/i, /vacant/i, /free (hai|hoga)/i, /आज/i] },
  { intent: "booking_request", patterns: [/book/i, /booking/i, /reserve/i, /confirm/i, /बुक/i] },
  { intent: "price_enquiry", patterns: [/price/i, /rate/i, /kitna/i, /cost/i, /charges?/i, /किराया/i, /रुपए|rupees?|₹/i, /24\s*hour/i] },
  { intent: "select_studio", patterns: [/studio\s*\d+/i, /option\s*[123]/i, /pehla|dusra|teesra/i, /\b(1|2|3)\b/] },
  { intent: "greeting", patterns: [/^(hi|hello|hey|namaste|hii+|good (morning|evening)|hola)\b/i] },
  { intent: "spam", patterns: [/crypto|forex|loan approval guaranteed|click here bit\.ly/i] },
];

export function detectIntent(text: string): { intent: CustomerIntent; confidence: number } {
  const body = text.trim();
  if (!body) return { intent: "unknown", confidence: 0.2 };

  // Prefer explicit intents before generic "details provided"
  for (const row of PATTERNS) {
    if (row.patterns.some((p) => p.test(body))) {
      return { intent: row.intent, confidence: 0.85 };
    }
  }

  // Detail-providing messages often include dates / durations without a clear verb
  if (/\b\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?\b/.test(body) || /\b\d+\s*(hour|hr|hrs|hours|दिन)\b/i.test(body)) {
    return { intent: "provide_details", confidence: 0.75 };
  }

  return { intent: "unknown", confidence: 0.35 };
}

export function requiresHumanHandover(intent: CustomerIntent, text: string, aiConfidence: number) {
  if (aiConfidence < 0.4 && intent === "unknown") return true;
  if (["refund_request", "complaint", "human_support", "cancellation"].includes(intent)) return true;
  if (/police|legal|lawyer|court|threat|abuse|harass/i.test(text)) return true;
  if (/pin|password|lock code|door code/i.test(text) && /before|now|send/i.test(text)) return true;
  return false;
}
