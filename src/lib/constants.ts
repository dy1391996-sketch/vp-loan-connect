import type { StaffRole } from "@prisma/client";

export const BRAND = {
  name: "VP Nest",
  tagline: "The Studio99Stay",
  fullName: "VP Nest – The Studio99Stay",
  location: "Gaur City Center, Greater Noida West",
} as const;

export const COOKIE_NAME = "vpnest_admin";

export const NAV_ITEMS: {
  href: string;
  label: string;
  roles?: StaffRole[];
  section?: string;
}[] = [
  { href: "/", label: "Command Center", section: "Overview" },
  { href: "/inbox", label: "Unified Inbox", section: "Customer" },
  { href: "/leads", label: "Leads", section: "Customer" },
  { href: "/customers", label: "Customers", section: "Customer" },
  { href: "/studios", label: "Studios", section: "Inventory" },
  { href: "/availability", label: "Availability", section: "Inventory" },
  { href: "/pricing", label: "Pricing", section: "Inventory" },
  { href: "/bookings", label: "Bookings", section: "Bookings" },
  { href: "/payments", label: "Payments", section: "Bookings" },
  { href: "/follow-ups", label: "Follow-ups", section: "Bookings" },
  { href: "/content", label: "Content Studio", section: "Marketing", roles: ["OWNER", "SOCIAL_MEDIA_MANAGER"] },
  { href: "/calendar", label: "Content Calendar", section: "Marketing", roles: ["OWNER", "SOCIAL_MEDIA_MANAGER"] },
  { href: "/media", label: "Media Library", section: "Marketing", roles: ["OWNER", "SOCIAL_MEDIA_MANAGER", "BOOKING_MANAGER"] },
  { href: "/comments", label: "Comments", section: "Marketing", roles: ["OWNER", "SOCIAL_MEDIA_MANAGER"] },
  { href: "/cleaning", label: "Cleaning", section: "Operations", roles: ["OWNER", "HOUSEKEEPING_MANAGER", "BOOKING_MANAGER"] },
  { href: "/maintenance", label: "Maintenance", section: "Operations", roles: ["OWNER", "HOUSEKEEPING_MANAGER", "BOOKING_MANAGER"] },
  { href: "/reviews", label: "Reviews", section: "Operations" },
  { href: "/analytics", label: "Analytics", section: "Intelligence", roles: ["OWNER", "BOOKING_MANAGER", "SOCIAL_MEDIA_MANAGER"] },
  { href: "/reports/daily", label: "Daily Reports", section: "Intelligence", roles: ["OWNER"] },
  { href: "/reports/weekly", label: "Weekly Reports", section: "Intelligence", roles: ["OWNER"] },
  { href: "/ai-rules", label: "AI Rules", section: "System", roles: ["OWNER"] },
  { href: "/templates", label: "Message Templates", section: "System", roles: ["OWNER", "BOOKING_MANAGER"] },
  { href: "/team", label: "Team", section: "System", roles: ["OWNER"] },
  { href: "/integrations", label: "Integrations", section: "System", roles: ["OWNER"] },
  { href: "/audit", label: "Audit Logs", section: "System", roles: ["OWNER"] },
  { href: "/settings", label: "Business Settings", section: "System", roles: ["OWNER"] },
];

export const AI_SYSTEM_PROMPT = `You are the official booking assistant for VP Nest – The Studio99Stay, a studio-apartment service in Gaur City Center, Greater Noida West.

Your job is to help customers with pricing, availability, studio selection, booking, payment, check-in information and basic support.

Always check live inventory and pricing tools before confirming availability or quoting a final amount.

Reply in the customer's language. Keep messages brief, natural, respectful and sales-focused without being pushy.

Collect the required date, check-in time, duration and number of guests before recommending a studio.

Never invent availability, pricing, discounts, facilities or policies.

Never confirm a booking until the payment-verification tool confirms payment.

Never share access codes, lock PINs or sensitive instructions before the configured verification requirements are completed.

Escalate refunds, payment disputes, serious complaints, legal issues, safety issues and uncertain cases to a human agent.

Your main objective is to provide accurate help and convert legitimate enquiries into confirmed bookings.`;

export const DEFAULT_WEEKDAY_SLABS = [
  { name: "Weekday 4–6h", minHours: 4, maxHours: 6, amountInr: 1499 },
  { name: "Weekday 8–10h", minHours: 8, maxHours: 10, amountInr: 1800 },
  { name: "Weekday 12–15h", minHours: 12, maxHours: 15, amountInr: 2000 },
  { name: "Weekday 24h", minHours: 24, maxHours: 24, amountInr: 2500 },
] as const;

export const DEFAULT_WEEKEND_SLABS = [
  { name: "Weekend 4–6h", minHours: 4, maxHours: 6, amountInr: 1800 },
  { name: "Weekend 8–10h", minHours: 8, maxHours: 10, amountInr: 2000 },
  { name: "Weekend 12–15h", minHours: 12, maxHours: 15, amountInr: 2300 },
  { name: "Weekend 24h", minHours: 24, maxHours: 24, amountInr: 3000 },
] as const;

export const DEFAULT_HOURLY = {
  weekday: 799,
  weekend: 999,
} as const;
