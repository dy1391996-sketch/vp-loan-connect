import type { LanguagePref } from "@prisma/client";
import { formatInr } from "@/lib/utils";
import type { CustomerIntent } from "@/lib/ai/intent";

export type BookingSlots = {
  name?: string;
  requiredDate?: string; // ISO date YYYY-MM-DD
  checkInTime?: string; // HH:mm
  durationHours?: number;
  guestCount?: number;
  preferBalcony?: boolean;
  preferJacuzzi?: boolean;
  preferPremium?: boolean;
  selectedStudioNumber?: string;
};

const DATE_PATTERNS = [
  /\b(\d{4})-(\d{2})-(\d{2})\b/,
  /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/,
  /\b(today|aaj)\b/i,
  /\b(tomorrow|kal)\b/i,
];

export function extractBookingSlots(text: string, now = new Date()): Partial<BookingSlots> {
  const slots: Partial<BookingSlots> = {};
  const lower = text.toLowerCase();

  if (/\b(today|aaj)\b/i.test(text)) {
    slots.requiredDate = isoDate(now);
  } else if (/\b(tomorrow|kal)\b/i.test(text)) {
    const t = new Date(now);
    t.setDate(t.getDate() + 1);
    slots.requiredDate = isoDate(t);
  } else {
    const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
    if (iso) slots.requiredDate = `${iso[1]}-${iso[2]}-${iso[3]}`;
    const dmy = text.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/);
    if (!slots.requiredDate && dmy) {
      const day = dmy[1].padStart(2, "0");
      const month = dmy[2].padStart(2, "0");
      let year = dmy[3];
      if (year.length === 2) year = `20${year}`;
      slots.requiredDate = `${year}-${month}-${day}`;
    }
  }

  const time = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (time && !DATE_PATTERNS[0].test(time[0])) {
    let hour = Number(time[1]);
    const minute = time[2] ?? "00";
    const mer = time[3]?.toLowerCase();
    if (mer === "pm" && hour < 12) hour += 12;
    if (mer === "am" && hour === 12) hour = 0;
    if (hour >= 0 && hour <= 23) slots.checkInTime = `${String(hour).padStart(2, "0")}:${minute}`;
  }

  const duration =
    text.match(/\b(\d+)\s*(?:hours?|hrs?|hr)\b/i) ||
    text.match(/\b(\d+)\s*h\b/i) ||
    text.match(/\b24\s*(?:hours?|hrs?)?\b/i);
  if (duration) {
    slots.durationHours = Number(duration[1] ?? 24);
  } else if (/\bfull day\b|\b24\b/.test(lower)) {
    slots.durationHours = 24;
  }

  const guests = text.match(/\b(\d+)\s*(?:guests?|people|persons?|pax)\b/i) || text.match(/\bfor\s*(\d+)\b/i);
  if (guests) slots.guestCount = Number(guests[1]);
  else if (/\bcouple\b/i.test(text)) slots.guestCount = 2;

  if (/balcony/i.test(text)) slots.preferBalcony = true;
  if (/jacuzzi/i.test(text)) slots.preferJacuzzi = true;
  if (/premium|view/i.test(text)) slots.preferPremium = true;

  const studio = text.match(/studio\s*(\d+)/i);
  if (studio) slots.selectedStudioNumber = studio[1];

  const nameMatch = text.match(/(?:my name is|main|i am|i'm)\s+([A-Za-z][A-Za-z\s]{1,40})/i);
  if (nameMatch) slots.name = nameMatch[1].trim();

  return slots;
}

export function missingSlotQuestion(slots: BookingSlots, lang: LanguagePref): string | null {
  if (!slots.requiredDate) return q(lang, "Please share your required date.", "Apni required date share kijiye.", "कृपया अपनी आवश्यक तिथि बताएं।");
  if (!slots.checkInTime) return q(lang, "What check-in time works for you?", "Check-in time kya rahega?", "चेक-इन समय क्या रहेगा?");
  if (!slots.durationHours) return q(lang, "How many hours do you need? (e.g. 6, 12 or 24)", "Kitne hours chahiye? (jaise 6, 12 ya 24)", "कितने घंटे चाहिए?");
  if (!slots.guestCount) return q(lang, "How many guests will stay?", "Kitne guests rahenge?", "कितने मेहमान रहेंगे?");
  return null;
}

function q(lang: LanguagePref, en: string, hinglish: string, hi: string) {
  if (lang === "HI") return hi;
  if (lang === "HINGLISH") return hinglish;
  return en;
}

export function mergeSlots(current: BookingSlots, next: Partial<BookingSlots>): BookingSlots {
  return {
    ...current,
    ...Object.fromEntries(Object.entries(next).filter(([, v]) => v !== undefined && v !== null && v !== "")),
  };
}

export function formatStudioRecommendations(
  studios: Array<{
    number: string;
    title: string;
    durationHours: number;
    price: { totalAmountInr: number };
    hasBalcony: boolean;
    hasJacuzzi: boolean;
    ready: boolean;
    coverImage?: string | null;
  }>,
  lang: LanguagePref,
) {
  if (!studios.length) {
    return q(
      lang,
      "No studios are free for that full period right now. Share another date/time or I can check a different duration.",
      "Us time ke liye koi studio free nahi hai. Koi aur date/time batayiye.",
      "उस अवधि के लिए कोई स्टूडियो उपलब्ध नहीं है। कृपया कोई अन्य तिथि बताएं।",
    );
  }
  const lines = studios.slice(0, 3).map((s, i) => {
    const features = [s.hasBalcony ? "Balcony" : null, s.hasJacuzzi ? "Jacuzzi" : null, s.ready ? "Ready" : "Cleaning check needed"]
      .filter(Boolean)
      .join(", ");
    const photo = s.coverImage ? `\nPhoto: ${s.coverImage}` : "";
    return `${i + 1}) Studio ${s.number} · ${s.durationHours}h · ${formatInr(s.price.totalAmountInr)} · ${features}${photo}`;
  });
  const intro = q(
    lang,
    "Here are available options. Reply with 1, 2 or 3 to continue.",
    "Available options yeh hain. 1, 2 ya 3 reply karke choose kijiye.",
    "उपलब्ध विकल्प ये हैं। जारी रखने के लिए 1, 2 या 3 लिखें।",
  );
  return `${intro}\n${lines.join("\n")}`;
}

export function staticIntentReply(intent: CustomerIntent, lang: LanguagePref): string | null {
  switch (intent) {
    case "location_request":
      return q(
        lang,
        "We are at Gaur City Center, Greater Noida West. Please share your required date and check-in time so I can check availability.",
        "Hum Gaur City Center, Greater Noida West mein hain. Date aur check-in time bataiye, availability check karta hoon.",
        "हम गौर सिटी सेंटर, ग्रेटर नोएडा वेस्ट में हैं। कृपया तिथि और चेक-इन समय बताएं।",
      );
    case "couple_friendly":
      return q(
        lang,
        "Yes — couple stays are welcome with valid government ID for all adults. Share date and duration to check a suitable studio.",
        "Haan, couple stay allowed hai with valid government ID. Date aur duration share kijiye.",
        "हाँ, कपल स्टे मान्य सरकारी पहचान पत्र के साथ उपलब्ध है।",
      );
    case "id_requirement":
      return q(
        lang,
        "Government ID is required for all guests before check-in. Access details are shared only after token payment and verification.",
        "Sabhi guests ka government ID zaroori hai. Access details token payment aur verification ke baad hi share hote hain.",
        "सभी मेहमानों का सरकारी पहचान पत्र आवश्यक है।",
      );
    case "opt_out":
      return q(lang, "Understood. We won’t message you again.", "Theek hai, aage message nahi bhejenge.", "ठीक है, हम आगे संदेश नहीं भेजेंगे।");
    default:
      return null;
  }
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}
