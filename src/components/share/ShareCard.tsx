"use client";

import { useEffect, useRef, useState } from "react";
import {
  drawShareCard,
  canvasToBlob,
  shareUrls,
  type ShareCardData,
} from "@/lib/share-card";
import { SITE_URL } from "@/lib/site-url";

interface ShareCardProps {
  data: ShareCardData;
  /** Download filename (without extension). */
  fileName: string;
  /** Prefilled text for X / LinkedIn. */
  shareText: string;
  /** Link to share; defaults to the site root. */
  shareUrl?: string;
}

export default function ShareCard({ data, fileName, shareText, shareUrl = SITE_URL }: ShareCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<string>("");

  // (Re)draw whenever the card data changes. Redraw once web fonts are ready so
  // the exported PNG uses Inter/JetBrains Mono rather than a fallback.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawShareCard(canvas, data);
    let cancelled = false;
    if (typeof document !== "undefined" && "fonts" in document) {
      document.fonts.ready.then(() => {
        if (!cancelled && canvasRef.current) drawShareCard(canvasRef.current, data);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [data]);

  async function downloadPng() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const blob = await canvasToBlob(canvas);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setStatus("Downloaded PNG ✓");
  }

  async function copyImage() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const blob = await canvasToBlob(canvas);
      if (!blob) throw new Error("no blob");
      // ClipboardItem with image/png — supported in Chromium/Safari, not Firefox.
      const item = new ClipboardItem({ "image/png": blob });
      await navigator.clipboard.write([item]);
      setStatus("Image copied ✓");
    } catch {
      setStatus("Copy isn't supported in this browser — use Download PNG.");
    }
  }

  const urls = shareUrls(shareText, shareUrl);
  const ariaLabel = `${data.eyebrow}: ${data.headline}. ${data.stats.map((s) => `${s.label} ${s.value}`).join(", ")}.`;

  return (
    <div className="flex flex-col gap-3">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={ariaLabel}
        className="h-auto w-full max-w-xl rounded-lg border border-border shadow-sm"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void downloadPng()}
          className="inline-flex min-h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
        >
          Download PNG
        </button>
        <button
          type="button"
          onClick={() => void copyImage()}
          className="inline-flex min-h-10 items-center rounded-lg border border-border px-4 text-sm font-medium text-text transition-colors hover:bg-surface-2"
        >
          Copy image
        </button>
        <a
          href={urls.x}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-10 items-center rounded-lg border border-border px-4 text-sm font-medium text-text transition-colors hover:bg-surface-2"
        >
          Share on X
        </a>
        <a
          href={urls.linkedin}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-10 items-center rounded-lg border border-border px-4 text-sm font-medium text-text transition-colors hover:bg-surface-2"
        >
          Share on LinkedIn
        </a>
      </div>
      {status && <p aria-live="polite" className="text-xs text-text-muted">{status}</p>}
      <p className="text-xs text-text-muted">
        Card is generated in your browser — nothing is uploaded or stored.
      </p>
    </div>
  );
}
