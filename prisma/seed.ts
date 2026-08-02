import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_HOURLY, DEFAULT_WEEKDAY_SLABS, DEFAULT_WEEKEND_SLABS } from "../src/lib/constants";

function loadEnvFile(name: string) {
  const path = resolve(process.cwd(), name);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index <= 0) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");

const prisma = new PrismaClient();

const STUDIOS = [
  {
    number: "101",
    title: "Studio 101 · Cozy Standard",
    floor: 1,
    category: "STANDARD" as const,
    hasBalcony: false,
    hasJacuzzi: false,
    viewType: "Courtyard",
    amenities: ["Wi-Fi", "AC", "Kitchenette", "TV"],
    publicDescription: "Comfortable standard studio ideal for short stays near Gaur City Center.",
  },
  {
    number: "102",
    title: "Studio 102 · Balcony Light",
    floor: 1,
    category: "BALCONY" as const,
    hasBalcony: true,
    hasJacuzzi: false,
    isPremium: false,
    viewType: "Street",
    amenities: ["Wi-Fi", "AC", "Kitchenette", "Balcony", "TV"],
    publicDescription: "Bright balcony studio with natural light — popular for couple stays.",
  },
  {
    number: "201",
    title: "Studio 201 · Premium View",
    floor: 2,
    category: "PREMIUM_VIEW" as const,
    isPremium: true,
    hasBalcony: true,
    hasJacuzzi: false,
    viewType: "City",
    weekdayPriceInr: 2800,
    weekendPriceInr: 3300,
    amenities: ["Wi-Fi", "AC", "Kitchenette", "Balcony", "Work desk", "TV"],
    publicDescription: "Premium-view studio with balcony and workspace for longer or special stays.",
  },
  {
    number: "202",
    title: "Studio 202 · Jacuzzi Retreat",
    floor: 2,
    category: "JACUZZI" as const,
    isPremium: true,
    hasBalcony: false,
    hasJacuzzi: true,
    viewType: "Internal",
    weekdayPriceInr: 3200,
    weekendPriceInr: 3800,
    amenities: ["Wi-Fi", "AC", "Kitchenette", "Jacuzzi", "TV", "Premium toiletries"],
    publicDescription: "Private jacuzzi studio for premium short stays. Couple-friendly and discreet.",
  },
  {
    number: "301",
    title: "Studio 301 · Work-from-Studio",
    floor: 3,
    category: "STANDARD" as const,
    hasBalcony: false,
    hasJacuzzi: false,
    viewType: "Quiet side",
    amenities: ["Wi-Fi", "AC", "Kitchenette", "Work desk", "TV"],
    publicDescription: "Quiet studio with desk setup — good for weekday work-from-studio bookings.",
  },
];

async function main() {
  const email = (process.env.ADMIN_EMAIL || "owner@vpnest.local").toLowerCase();
  const password = process.env.ADMIN_INITIAL_PASSWORD || "ChangeMeNow!123";
  if (password.length < 12) throw new Error("ADMIN_INITIAL_PASSWORD must be at least 12 characters.");

  const passwordHash = await bcrypt.hash(password, 12);
  const owner = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: "VP Nest Owner",
      passwordHash,
      role: "OWNER",
      active: true,
    },
    update: {
      passwordHash,
      role: "OWNER",
      active: true,
      name: "VP Nest Owner",
    },
  });

  // Demo staff (same password for local sandbox only)
  const staffSeeds = [
    { email: "booking@vpnest.local", name: "Booking Manager", role: "BOOKING_MANAGER" as const },
    { email: "social@vpnest.local", name: "Social Media Manager", role: "SOCIAL_MEDIA_MANAGER" as const },
    { email: "housekeeping@vpnest.local", name: "Housekeeping Manager", role: "HOUSEKEEPING_MANAGER" as const },
    { email: "readonly@vpnest.local", name: "Read Only Staff", role: "READ_ONLY" as const },
  ];
  for (const s of staffSeeds) {
    await prisma.user.upsert({
      where: { email: s.email },
      create: { ...s, passwordHash, active: true },
      update: { name: s.name, role: s.role, passwordHash, active: true },
    });
  }

  for (const [index, studio] of STUDIOS.entries()) {
    await prisma.studio.upsert({
      where: { number: studio.number },
      create: {
        number: studio.number,
        property: "Gaur City Center",
        building: "VP Nest",
        floor: studio.floor,
        title: studio.title,
        category: studio.category,
        isPremium: "isPremium" in studio ? Boolean(studio.isPremium) : studio.category !== "STANDARD",
        hasBalcony: studio.hasBalcony,
        hasJacuzzi: studio.hasJacuzzi,
        viewType: studio.viewType,
        maxGuests: 2,
        amenities: studio.amenities,
        weekdayPriceInr: "weekdayPriceInr" in studio ? studio.weekdayPriceInr : null,
        weekendPriceInr: "weekendPriceInr" in studio ? studio.weekendPriceInr : null,
        hourlyPriceInr: null,
        publicDescription: studio.publicDescription,
        availabilityStatus: "AVAILABLE",
        cleaningStatus: "READY",
        active: true,
        sortOrder: index + 1,
        createdById: owner.id,
        media: {
          create: {
            url: `https://placehold.co/800x1000/1c2836/f6f3ee/png?text=Studio+${studio.number}`,
            mediaType: "image",
            isCover: true,
            approved: true,
            isCurrent: true,
            tags: ["studio", studio.number, studio.category.toLowerCase()],
            reelReady: true,
            storyReady: true,
            orientation: "vertical",
            dayNight: "day",
          },
        },
      },
      update: {
        title: studio.title,
        publicDescription: studio.publicDescription,
        amenities: studio.amenities,
        active: true,
      },
    });
  }

  // Clear and reseed core pricing slabs for idempotent local setup
  await prisma.pricingRule.deleteMany({
    where: { type: { in: ["WEEKDAY_SLAB", "WEEKEND_SLAB", "HOURLY", "PREMIUM_SURCHARGE"] } },
  });

  for (const slab of DEFAULT_WEEKDAY_SLABS) {
    await prisma.pricingRule.create({
      data: {
        name: slab.name,
        type: "WEEKDAY_SLAB",
        dayType: "WEEKDAY",
        minHours: slab.minHours,
        maxHours: slab.maxHours,
        amountInr: slab.amountInr,
        priority: 10,
        active: true,
        approved: true,
        createdById: owner.id,
      },
    });
  }
  for (const slab of DEFAULT_WEEKEND_SLABS) {
    await prisma.pricingRule.create({
      data: {
        name: slab.name,
        type: "WEEKEND_SLAB",
        dayType: "WEEKEND",
        minHours: slab.minHours,
        maxHours: slab.maxHours,
        amountInr: slab.amountInr,
        priority: 10,
        active: true,
        approved: true,
        createdById: owner.id,
      },
    });
  }
  await prisma.pricingRule.createMany({
    data: [
      {
        name: "Weekday hourly",
        type: "HOURLY",
        dayType: "WEEKDAY",
        amountInr: DEFAULT_HOURLY.weekday,
        priority: 50,
        active: true,
        approved: true,
        createdById: owner.id,
      },
      {
        name: "Weekend hourly",
        type: "HOURLY",
        dayType: "WEEKEND",
        amountInr: DEFAULT_HOURLY.weekend,
        priority: 50,
        active: true,
        approved: true,
        createdById: owner.id,
      },
      {
        name: "Premium feature surcharge",
        type: "PREMIUM_SURCHARGE",
        dayType: "ANY",
        amountInr: 300,
        isPercent: false,
        priority: 80,
        active: true,
        approved: true,
        createdById: owner.id,
      },
      {
        name: "Demo WELCOME100",
        type: "COUPON",
        dayType: "ANY",
        amountInr: 100,
        couponCode: "WELCOME100",
        priority: 20,
        active: true,
        approved: true,
        requiresOwnerApproval: false,
        createdById: owner.id,
      },
    ],
  });

  const settings: { key: string; value: object }[] = [
    { key: "hold_minutes", value: { minutes: Number(process.env.HOLD_MINUTES || 15) } },
    { key: "token_percent", value: { percent: Number(process.env.TOKEN_PERCENT || 30) } },
    { key: "content_mode", value: { mode: "DRAFT" } },
    { key: "business_location", value: { address: "Gaur City Center, Greater Noida West" } },
    { key: "check_in_policy", value: { message: "Access details are shared after token payment and ID verification." } },
    {
      key: "ai_safety",
      value: {
        neverInventPrices: true,
        neverSharePinBeforeAuth: true,
        requireApprovalForSensitiveContent: true,
      },
    },
  ];
  for (const s of settings) {
    await prisma.businessSetting.upsert({
      where: { key: s.key },
      create: { key: s.key, value: s.value, createdById: owner.id },
      update: { value: s.value },
    });
  }

  const integrations = [
    "WHATSAPP",
    "INSTAGRAM",
    "RAZORPAY",
    "OPENAI",
    "CLOUDINARY",
  ] as const;
  for (const provider of integrations) {
    await prisma.integration.upsert({
      where: { provider },
      create: {
        provider,
        enabled: false,
        sandboxMode: true,
        metadata: { note: "Configure credentials in environment variables. Sandbox adapters are active locally." },
        createdById: owner.id,
      },
      update: {},
    });
  }

  await prisma.messageTemplate.upsert({
    where: { key: "welcome_en" },
    create: {
      key: "welcome_en",
      channel: "WHATSAPP",
      language: "EN",
      name: "Welcome",
      body: "Welcome to VP Nest – The Studio99Stay. Please share your required date and check-in time.",
      approved: true,
      active: true,
      createdById: owner.id,
    },
    update: {},
  });
  await prisma.messageTemplate.upsert({
    where: { key: "welcome_hi" },
    create: {
      key: "welcome_hi",
      channel: "WHATSAPP",
      language: "HI",
      name: "Welcome Hindi",
      body: "VP Nest – The Studio99Stay mein aapka swagat hai. Apni required date aur check-in time share kijiye.",
      approved: true,
      active: true,
      createdById: owner.id,
    },
    update: {},
  });

  // Sample customer + lead for demo inbox/CRM
  const customer = await prisma.customer.upsert({
    where: { phone: "+919876543210" },
    create: {
      name: "Demo Guest",
      phone: "+919876543210",
      preferredLanguage: "HINGLISH",
      memorySummary: "Interested in balcony studio for weekend short stay.",
    },
    update: { name: "Demo Guest" },
  });
  await prisma.customerChannel.upsert({
    where: { channel_externalId: { channel: "WHATSAPP", externalId: "919876543210" } },
    create: {
      customerId: customer.id,
      channel: "WHATSAPP",
      externalId: "919876543210",
      displayName: "Demo Guest",
    },
    update: {},
  });
  const existingLead = await prisma.lead.findFirst({ where: { customerId: customer.id, stage: "NEW_ENQUIRY" } });
  if (!existingLead) {
    await prisma.lead.create({
      data: {
        customerId: customer.id,
        source: "WHATSAPP",
        name: "Demo Guest",
        phone: "+919876543210",
        stage: "NEW_ENQUIRY",
        temperature: "WARM",
        bookingProbability: 35,
        guestCount: 2,
        durationHours: 24,
        conversationSummary: "Asked for weekend 24-hour price and balcony option.",
        aiDetectedIntent: "price_enquiry",
      },
    });
  }

  console.log("Seed complete.");
  console.log(`Owner login: ${email} / (ADMIN_INITIAL_PASSWORD)`);
  console.log("Demo staff: booking@|social@|housekeeping@|readonly@vpnest.local with same password.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
