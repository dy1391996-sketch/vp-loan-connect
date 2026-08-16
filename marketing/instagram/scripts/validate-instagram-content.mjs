#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { POSTS } from "./posts-catalog.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const banned = [/wa\.me/i, /\btel:/i, /call now/i, /guaranteed approval/i, /100%\s*approval/i, /instant guaranteed/i, /(?<!no[^\n]{0,20})whatsapp/i];

let failed = 0;
for (const post of POSTS) {
  const dir = path.join(ROOT, "posts", post.n);
  const png = path.join(dir, `post-${post.n}.png`);
  const caption = fs.readFileSync(path.join(dir, "caption.txt"), "utf8");
  if (!fs.existsSync(png)) {
    console.error("MISSING", png);
    failed++;
    continue;
  }
  const meta = await sharp(png).metadata();
  if (meta.width !== 1080 || meta.height !== 1350) {
    console.error("BAD_DIM", post.n, meta.width, meta.height);
    failed++;
  }
  for (const re of banned) {
    if (re.test(caption)) {
      console.error("BANNED_TEXT", post.n, re);
      failed++;
    }
  }
  if (!/not a lender/i.test(caption)) {
    console.error("MISSING_DISCLAIMER", post.n);
    failed++;
  }
}
const profile = path.join(ROOT, "profile/vploanconnect-profile-1080.png");
const pmeta = await sharp(profile).metadata();
if (pmeta.width !== 1080 || pmeta.height !== 1080) {
  console.error("BAD_PROFILE_DIM", pmeta);
  failed++;
}
if (failed) {
  console.error(`VALIDATION_FAILED ${failed}`);
  process.exit(1);
}
console.log("VALIDATION_OK", POSTS.length);
