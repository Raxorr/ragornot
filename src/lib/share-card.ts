// Client-side branded share-card renderer. Draws a 1200×630 (OG ratio) card on
// a canvas so results from the Benchmark or /decide can be copied, downloaded,
// or shared as a clean image. No backend, no data stored. Deliberately uses the
// brand LIGHT palette regardless of the viewer's theme so shared cards look
// consistent everywhere.

export interface ShareStat {
  label: string;
  value: string;
}

export interface ShareCardData {
  /** Small uppercase kicker, e.g. "ragornot benchmark". */
  eyebrow: string;
  /** The headline result, e.g. "RAG wins" or "Use RAG". */
  headline: string;
  /** Up to 4 key numbers. */
  stats: ShareStat[];
  /** Small footer note (optional). */
  note?: string;
}

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

const COLORS = {
  bg: "#fbf7f4",
  panel: "#ffffff",
  border: "#e7ddd4",
  text: "#1a1512",
  muted: "#6b5f57",
  accent: "#e8481f",
  accentText: "#b5330f",
};

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draw the wordmark "ragornot" starting at (x, baseline). Returns the end x. */
function drawWordmark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): number {
  ctx.textBaseline = "alphabetic";
  ctx.font = `800 ${size}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = COLORS.text;
  ctx.fillText("rag", x, y);
  const ragW = ctx.measureText("rag").width;
  ctx.font = `400 ${size}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = COLORS.muted;
  ctx.fillText("ornot", x + ragW, y);
  return x + ragW + ctx.measureText("ornot").width;
}

/** Wrap `text` to `maxWidth`, returning lines. */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Render the card onto an existing canvas element (sets its width/height). */
export function drawShareCard(canvas: HTMLCanvasElement, data: ShareCardData) {
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Background + coral edge.
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  ctx.fillStyle = COLORS.accent;
  ctx.fillRect(0, 0, 14, CARD_HEIGHT);

  const pad = 72;

  // Wordmark + eyebrow (top row).
  drawWordmark(ctx, pad, 96, 40);
  ctx.textBaseline = "alphabetic";
  ctx.font = "700 22px Inter, system-ui, sans-serif";
  ctx.fillStyle = COLORS.accentText;
  const eyebrow = data.eyebrow.toUpperCase();
  const eyebrowW = ctx.measureText(eyebrow).width;
  ctx.fillText(eyebrow, CARD_WIDTH - pad - eyebrowW, 92);

  // Headline (wrapped, up to 3 lines).
  ctx.font = "800 76px Inter, system-ui, sans-serif";
  ctx.fillStyle = COLORS.text;
  const lines = wrapText(ctx, data.headline, CARD_WIDTH - pad * 2).slice(0, 3);
  let y = 236;
  for (const line of lines) {
    ctx.fillText(line, pad, y);
    y += 86;
  }

  // Stat tiles row (up to 4).
  const stats = data.stats.slice(0, 4);
  if (stats.length > 0) {
    const gap = 20;
    const tileY = 428;
    const tileH = 118;
    const totalGap = gap * (stats.length - 1);
    const tileW = (CARD_WIDTH - pad * 2 - totalGap) / stats.length;
    stats.forEach((s, i) => {
      const x = pad + i * (tileW + gap);
      ctx.fillStyle = COLORS.panel;
      roundRect(ctx, x, tileY, tileW, tileH, 16);
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = COLORS.border;
      roundRect(ctx, x, tileY, tileW, tileH, 16);
      ctx.stroke();

      ctx.font = "600 20px Inter, system-ui, sans-serif";
      ctx.fillStyle = COLORS.muted;
      ctx.fillText(s.label.toUpperCase(), x + 22, tileY + 44);

      ctx.font = "700 40px 'JetBrains Mono', ui-monospace, monospace";
      ctx.fillStyle = COLORS.text;
      ctx.fillText(s.value, x + 22, tileY + 92);
    });
  }

  // Footer: URL + note.
  ctx.font = "800 30px Inter, system-ui, sans-serif";
  ctx.fillStyle = COLORS.accentText;
  ctx.fillText("ragornot.com", pad, CARD_HEIGHT - 56);

  if (data.note) {
    ctx.font = "400 22px Inter, system-ui, sans-serif";
    ctx.fillStyle = COLORS.muted;
    const noteW = ctx.measureText(data.note).width;
    ctx.fillText(data.note, CARD_WIDTH - pad - noteW, CARD_HEIGHT - 58);
  }
}

/** Canvas → PNG Blob (promise). */
export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}

/** Prefilled share intent URLs (open in a new tab). */
export function shareUrls(text: string, url: string) {
  const t = encodeURIComponent(text);
  const u = encodeURIComponent(url);
  return {
    x: `https://twitter.com/intent/tweet?text=${t}&url=${u}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
  };
}
