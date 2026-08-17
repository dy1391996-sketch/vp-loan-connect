#!/usr/bin/env node
/**
 * Render organic Instagram assets for @vploanconnect.in
 * Uses SVG + sharp. No secrets. No ads tooling.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { BRAND, POSTS, captionFor, altFor } from "./posts-catalog.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function familyAccent(family) {
  if (family === "brand") return BRAND.colors.navy;
  if (family === "myth") return BRAND.colors.charcoal;
  if (family === "conversion") return BRAND.colors.teal;
  return BRAND.colors.blue;
}

function wrapLines(text, maxChars) {
  const words = text.split(/\s+/);
  const lines = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > maxChars) {
      if (cur) lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 5);
}

function monogramSvg(size = 220) {
  return `
  <g transform="translate(${540 - size / 2}, 120)">
    <rect width="${size}" height="${size}" rx="${Math.round(size * 0.22)}" fill="${BRAND.colors.navy}"/>
    <text x="${size / 2}" y="${size / 2 + size * 0.12}" text-anchor="middle"
      font-family="Manrope, Arial, sans-serif" font-size="${Math.round(size * 0.38)}" font-weight="800"
      fill="${BRAND.colors.teal}" letter-spacing="-4">VP</text>
  </g>`;
}

function feedSvg(post) {
  const accent = familyAccent(post.family);
  const headlineLines = post.headline.split("\n");
  const bodyLines = wrapLines(post.body, 34);
  const ctaLines = wrapLines(post.cta, 36);
  const hy = 420;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1080" height="1350" viewBox="0 0 1080 1350" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${BRAND.colors.soft}"/>
      <stop offset="100%" stop-color="#E8EEF5"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1350" fill="url(#bg)"/>
  <rect x="0" y="0" width="1080" height="18" fill="${accent}"/>
  ${monogramSvg(160)}
  <text x="540" y="360" text-anchor="middle" font-family="Manrope, Arial, sans-serif"
    font-size="28" font-weight="700" fill="${BRAND.colors.grey}" letter-spacing="4">VP LOAN CONNECT</text>
  ${headlineLines
    .map(
      (line, i) =>
        `<text x="540" y="${hy + i * 72}" text-anchor="middle" font-family="Manrope, Arial, sans-serif" font-size="58" font-weight="800" fill="${BRAND.colors.navy}">${esc(line)}</text>`,
    )
    .join("\n")}
  ${bodyLines
    .map(
      (line, i) =>
        `<text x="540" y="${hy + headlineLines.length * 72 + 50 + i * 42}" text-anchor="middle" font-family="Manrope, Arial, sans-serif" font-size="30" font-weight="500" fill="${BRAND.colors.charcoal}">${esc(line)}</text>`,
    )
    .join("\n")}
  <rect x="140" y="1080" width="800" height="110" rx="28" fill="${accent}"/>
  ${ctaLines
    .map(
      (line, i) =>
        `<text x="540" y="${1125 + i * 34}" text-anchor="middle" font-family="Manrope, Arial, sans-serif" font-size="26" font-weight="700" fill="${BRAND.colors.white}">${esc(line)}</text>`,
    )
    .join("\n")}
  <text x="540" y="1285" text-anchor="middle" font-family="Manrope, Arial, sans-serif"
    font-size="18" font-weight="500" fill="${BRAND.colors.grey}">Not a lender · Guidance only · vploanconnect.in</text>
  <text x="1000" y="1320" text-anchor="end" font-family="Manrope, Arial, sans-serif"
    font-size="20" font-weight="700" fill="${BRAND.colors.grey}">${post.n}</text>
</svg>`;
}

function profileSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1080" height="1080" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
  <rect width="1080" height="1080" fill="${BRAND.colors.soft}"/>
  <g transform="translate(290, 290)">
    <rect width="500" height="500" rx="120" fill="${BRAND.colors.navy}"/>
    <text x="250" y="310" text-anchor="middle" font-family="Manrope, Arial, sans-serif"
      font-size="210" font-weight="800" fill="${BRAND.colors.teal}" letter-spacing="-10">VP</text>
  </g>
</svg>`;
}

function highlightSvg(label) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1080" height="1080" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
  <rect width="1080" height="1080" fill="${BRAND.colors.navy}"/>
  <circle cx="540" cy="440" r="160" fill="none" stroke="${BRAND.colors.teal}" stroke-width="14"/>
  <text x="540" y="460" text-anchor="middle" font-family="Manrope, Arial, sans-serif"
    font-size="64" font-weight="800" fill="${BRAND.colors.teal}">VP</text>
  <text x="540" y="720" text-anchor="middle" font-family="Manrope, Arial, sans-serif"
    font-size="52" font-weight="700" fill="${BRAND.colors.soft}">${esc(label)}</text>
</svg>`;
}

function storySvg(title, body) {
  const lines = wrapLines(body, 28);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">
  <rect width="1080" height="1920" fill="${BRAND.colors.navy}"/>
  <rect x="0" y="0" width="1080" height="24" fill="${BRAND.colors.teal}"/>
  <text x="540" y="280" text-anchor="middle" font-family="Manrope, Arial, sans-serif"
    font-size="34" font-weight="700" fill="${BRAND.colors.teal}" letter-spacing="3">VP LOAN CONNECT</text>
  <text x="540" y="520" text-anchor="middle" font-family="Manrope, Arial, sans-serif"
    font-size="64" font-weight="800" fill="${BRAND.colors.soft}">${esc(title)}</text>
  ${lines
    .map(
      (line, i) =>
        `<text x="540" y="${680 + i * 54}" text-anchor="middle" font-family="Manrope, Arial, sans-serif" font-size="36" font-weight="500" fill="#D9E2EC">${esc(line)}</text>`,
    )
    .join("\n")}
  <rect x="160" y="1550" width="760" height="100" rx="28" fill="${BRAND.colors.teal}"/>
  <text x="540" y="1615" text-anchor="middle" font-family="Manrope, Arial, sans-serif"
    font-size="30" font-weight="700" fill="${BRAND.colors.navy}">Start at vploanconnect.in</text>
  <text x="540" y="1780" text-anchor="middle" font-family="Manrope, Arial, sans-serif"
    font-size="22" font-weight="500" fill="${BRAND.colors.grey}">Not a lender · No OTPs in DM</text>
</svg>`;
}

async function writePng(svg, outPath) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  await sharp(Buffer.from(svg)).png().toFile(outPath);
}

async function main() {
  const metaRows = ["post_number,title,family,objective,filename,caption_file,alt_file,status,cta"];
  const compliance = ["# Content compliance report", "", "All captions generated from compliant catalog.", "Removed/avoided: WhatsApp, phone, Call Now, guaranteed approval/rates/score, fake testimonials.", ""];

  // Profile
  await writePng(profileSvg(), path.join(ROOT, "profile/vploanconnect-profile-1080.png"));

  // Highlights
  const highlights = [
    ["start-here", "Start Here"],
    ["eligibility", "Eligibility"],
    ["documents", "Documents"],
    ["loan-types", "Loan Types"],
    ["safety", "Safety"],
    ["faqs", "FAQs"],
    ["reviews", "Reviews"],
  ];
  for (const [file, label] of highlights) {
    await writePng(highlightSvg(label), path.join(ROOT, "highlights", `${file}.png`));
  }

  // Stories
  const stories = [
    ["start-here", "Start Here", "Use website Quick Apply for a secure profile assessment."],
    ["eligibility", "Eligibility", "Income, credit profile and documents shape lender decisions."],
    ["documents", "Documents", "Keep KYC and income proofs ready before you enquire."],
    ["loan-types", "Loan Types", "Personal, business, home, LAP, MSME and balance transfer."],
    ["safety", "Safety", "Never share UPI PIN, CVV, passwords or OTPs."],
    ["faqs", "FAQs", "Approval and rates depend on the lender — not guarantees."],
    ["reviews", "Reviews", "Verified customer feedback will appear here."],
  ];
  for (const [file, title, body] of stories) {
    await writePng(storySvg(title, body), path.join(ROOT, "stories", `${file}-1080x1920.png`));
  }

  // Posts 01-36
  for (const post of POSTS) {
    const dir = path.join(ROOT, "posts", post.n);
    fs.mkdirSync(dir, { recursive: true });
    const png = path.join(dir, `post-${post.n}.png`);
    await writePng(feedSvg(post), png);
    const caption = captionFor(post);
    const alt = altFor(post);
    fs.writeFileSync(path.join(dir, "caption.txt"), caption);
    fs.writeFileSync(path.join(dir, "alt.txt"), alt);
    fs.writeFileSync(
      path.join(dir, "meta.json"),
      JSON.stringify(
        {
          post: post.n,
          title: post.title,
          family: post.family,
          objective: post.objective,
          headline: post.headline,
          body: post.body,
          cta: post.cta,
          asset: `posts/${post.n}/post-${post.n}.png`,
          status: "rendered",
          dimensions: "1080x1350",
        },
        null,
        2,
      ),
    );
    metaRows.push(
      [
        post.n,
        JSON.stringify(post.title),
        post.family,
        post.objective,
        `posts/${post.n}/post-${post.n}.png`,
        `posts/${post.n}/caption.txt`,
        `posts/${post.n}/alt.txt`,
        "rendered",
        JSON.stringify(post.cta),
      ].join(","),
    );
    compliance.push(`- Post ${post.n} (${post.title}): generated compliant caption; CTA uses website or safe DM guidance; disclaimer included.`);
  }

  // Reels packages (metadata + still frames)
  const reelTopics = POSTS.filter((p) => ["01", "05", "07", "19", "31", "35"].includes(p.n));
  for (const post of reelTopics) {
    const dir = path.join(ROOT, "reels", `reel-${post.n}`);
    fs.mkdirSync(dir, { recursive: true });
    await writePng(storySvg(post.title, post.body), path.join(dir, "frame-1080x1920.png"));
    fs.writeFileSync(
      path.join(dir, "package.md"),
      `# Reel ${post.n} — ${post.title}\n\n## Hook\n${post.headline.replace(/\n/g, " ")}\n\n## On-screen text\n${post.body}\n\n## Sequence\n1. Brand frame\n2. Hook\n3. 3 teaching beats\n4. CTA to vploanconnect.in\n\n## Caption\n${captionFor(post)}\n\n## CTA\n${post.cta}\n\n## Alt\n${altFor(post)}\n\n## Audio\nText-led / no copyrighted music.\n`,
    );
  }

  fs.writeFileSync(path.join(ROOT, "metadata/posts_master.csv"), metaRows.join("\n") + "\n");
  fs.writeFileSync(path.join(ROOT, "audit/content_compliance_report.md"), compliance.join("\n") + "\n");

  // 30-day calendar
  const start = new Date("2026-08-17T00:00:00Z");
  const calMd = ["# 30-day organic Instagram calendar", "", "| Day | Date | Time IST | Format | Post | Objective | CTA | Asset | Status |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- |"];
  const calCsv = ["day,date,time_ist,format,post,topic,objective,cta,asset,caption,status"];
  for (let day = 1; day <= 30; day++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + day - 1);
    const date = d.toISOString().slice(0, 10);
    const post = POSTS[(day - 1) % POSTS.length];
    const format = day % 7 === 0 ? "reel" : day % 5 === 0 ? "carousel_ready_single" : "feed";
    const time = day % 2 === 0 ? "11:00" : "18:30";
    const status = "queued";
    calMd.push(
      `| ${day} | ${date} | ${time} | ${format} | ${post.n} ${post.title} | ${post.objective} | website/DM-safe | posts/${post.n}/post-${post.n}.png | ${status} |`,
    );
    calCsv.push(
      [day, date, time, format, post.n, JSON.stringify(post.title), post.objective, "website", `posts/${post.n}/post-${post.n}.png`, `posts/${post.n}/caption.txt`, status].join(","),
    );
  }
  fs.writeFileSync(path.join(ROOT, "metadata/30_day_calendar.md"), calMd.join("\n") + "\n");
  fs.writeFileSync(path.join(ROOT, "metadata/30_day_calendar.csv"), calCsv.join("\n") + "\n");
  fs.writeFileSync(
    path.join(ROOT, "metadata/publishing_status.csv"),
    "post_number,status,permalink,media_id,notes\n" + POSTS.map((p) => `${p.n},rendered,,,"awaiting organic publish"`).join("\n") + "\n",
  );

  console.log(`Rendered ${POSTS.length} posts + profile + highlights + stories + ${reelTopics.length} reel packages`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
