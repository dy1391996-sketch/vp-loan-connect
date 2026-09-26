import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "creatives");

const navy = "#102A43";
const teal = "#0F9D8A";
const blue = "#2563EB";
const ink = "#F8FBFC";
const muted = "#D5E0EA";

function escapeXml(value) {
  return value.replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[char]);
}

function frame({ width, height, accent, kicker, title, lines, footer }) {
  const side = Math.round(width * 0.08);
  const vertical = height > 2000;
  const markY = Math.round(height * (vertical ? 0.2 : 0.14));
  const kickerY = markY + 150;
  const titleSize = Math.round(width * (vertical ? 0.07 : 0.064));
  const titleY = kickerY + titleSize + 24;
  const lineSize = Math.round(width * 0.036);
  let cursor = titleY + 90;
  const text = lines
    .map((line) => {
      const y = cursor;
      cursor += lineSize + 42;
      return `<text x="${side}" y="${y}" fill="${muted}" font-size="${lineSize}" font-family="Noto Sans, sans-serif">${escapeXml(line)}</text>`;
    })
    .join("");
  const footerY = Math.min(cursor + 72, Math.round(height * (vertical ? 0.58 : 0.82)));
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="${navy}"/>
  <rect x="0" y="0" width="18" height="${height}" fill="${accent}"/>
  <circle cx="${width - 120}" cy="${markY}" r="220" fill="${accent}" fill-opacity="0.18"/>
  <rect x="${side}" y="${markY}" width="96" height="96" rx="24" fill="${accent}"/>
  <text x="${side + 22}" y="${markY + 62}" fill="${navy}" font-size="36" font-weight="700" font-family="Noto Sans, sans-serif">VP</text>
  <text x="${side}" y="${kickerY}" fill="${accent}" font-size="28" font-weight="700" font-family="Noto Sans, sans-serif">${escapeXml(kicker)}</text>
  <text x="${side}" y="${titleY}" fill="${ink}" font-size="${titleSize}" font-weight="700" font-family="Noto Sans, sans-serif">${escapeXml(title)}</text>
  ${text}
  <text x="${side}" y="${footerY}" fill="${ink}" font-size="40" font-weight="700" font-family="Noto Sans, sans-serif">${escapeXml(footer)}</text>
  <text x="${side}" y="${footerY + 52}" fill="${muted}" font-size="26" font-family="Noto Sans, sans-serif">Not a bank, NBFC or lender</text>
</svg>`;
}

const assets = [
  {
    file: "concept-a-feed-4x5.png",
    width: 1440,
    height: 1800,
    accent: teal,
    kicker: "LOAN ASSISTANCE",
    title: "Loan options samajhiye",
    lines: ["Application ki taiyari kijiye.", "Enquiry submit karein.", "Guidance only. No guaranteed approval."],
    footer: "VP Loan Connect",
  },
  {
    file: "concept-a-stories-reels-9x16.png",
    width: 1440,
    height: 2560,
    accent: teal,
    kicker: "LOAN ASSISTANCE",
    title: "Loan options samajhiye",
    lines: ["Application ki taiyari kijiye.", "VP Loan Connect", "Enquiry submit karein."],
    footer: "Learn more on the website",
  },
  {
    file: "concept-b-feed-4x5.png",
    width: 1440,
    height: 1800,
    accent: blue,
    kicker: "PREPARE YOUR APPLICATION",
    title: "Loan assistance",
    lines: ["Category, documents and next steps.", "Submit an enquiry to VP Loan Connect.", "A lender decides approval and rate."],
    footer: "VP Loan Connect",
  },
  {
    file: "concept-b-stories-reels-9x16.png",
    width: 1440,
    height: 2560,
    accent: blue,
    kicker: "PREPARE YOUR APPLICATION",
    title: "Loan assistance",
    lines: ["Samajhiye. Taiyari kijiye.", "Enquiry submit karein.", "VP Loan Connect is not a lender."],
    footer: "Learn more on the website",
  },
];

await mkdir(root, { recursive: true });
for (const asset of assets) {
  const svg = frame(asset);
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const meta = await sharp(png).metadata();
  if (meta.width !== asset.width || meta.height !== asset.height) {
    throw new Error(`${asset.file} rendered ${meta.width}x${meta.height}`);
  }
  await writeFile(path.join(root, asset.file), png);
  process.stdout.write(`${asset.file} ${meta.width}x${meta.height}\n`);
}
