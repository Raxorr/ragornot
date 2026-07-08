#!/usr/bin/env node
/**
 * generate-og-image.mjs
 *
 * Renders the 1200×630 social-preview card to public/og-image.png from an
 * on-brand SVG, using sharp (already a dependency via Next.js). Run once and
 * commit the PNG; re-run whenever the wordmark or tagline changes:
 *
 *   node scripts/generate-og-image.mjs
 *
 * Colours are the light-theme brand tokens from src/app/globals.css.
 */

import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const BG = "#fbf7f4";        // --bg  (warm cream)
const SURFACE_2 = "#f4ede7"; // --surface-2
const TEXT = "#1a1512";      // --text
const TEXT_MUTED = "#6b5f57"; // --text-muted
const ACCENT = "#e8481f";    // --accent (coral)

const W = 1200;
const H = 630;

const MODES = ["Flat / BM25", "Hierarchical", "LLM-only", "RAG"];

// Simple left-anchored chip row, drawn as rounded rects with centered labels.
function chips(startX, y) {
  let x = startX;
  const parts = [];
  for (const label of MODES) {
    const w = 46 + label.length * 12.5;
    parts.push(`
      <rect x="${x}" y="${y}" width="${w}" height="52" rx="26" fill="${SURFACE_2}" stroke="${ACCENT}" stroke-opacity="0.35"/>
      <text x="${x + w / 2}" y="${y + 34}" font-family="Helvetica, Arial, sans-serif" font-size="24" font-weight="500" fill="${TEXT_MUTED}" text-anchor="middle">${label}</text>
    `);
    x += w + 18;
  }
  return parts.join("");
}

const svg = `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <!-- Coral spine on the left edge -->
  <rect x="0" y="0" width="16" height="${H}" fill="${ACCENT}"/>

  <!-- Eyebrow -->
  <text x="90" y="150" font-family="Helvetica, Arial, sans-serif" font-size="26" font-weight="700" letter-spacing="5" fill="${ACCENT}">RAG OR NOT — COMPARE. LEARN. DECIDE.</text>

  <!-- Wordmark -->
  <text x="86" y="300" font-family="Helvetica, Arial, sans-serif" font-size="150" font-weight="800" fill="${TEXT}">rag<tspan font-weight="400" fill="${TEXT_MUTED}">ornot</tspan></text>

  <!-- Accent underline -->
  <rect x="90" y="330" width="240" height="10" rx="5" fill="${ACCENT}"/>

  <!-- Tagline (two lines) -->
  <text x="90" y="420" font-family="Helvetica, Arial, sans-serif" font-size="40" font-weight="500" fill="${TEXT}">A live retrieval-mode benchmark over AWS docs —</text>
  <text x="90" y="472" font-family="Helvetica, Arial, sans-serif" font-size="40" font-weight="500" fill="${TEXT}">measure RAG on cost, latency, quality, and carbon.</text>

  <!-- Mode chips -->
  ${chips(90, 528)}
</svg>
`;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, "..", "public", "og-image.png");

await sharp(Buffer.from(svg)).png().toFile(outPath);
console.log(`[og-image] wrote ${W}×${H} → ${path.relative(path.join(__dirname, ".."), outPath)}`);
