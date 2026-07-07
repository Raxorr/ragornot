"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import type { NewsItem } from "@/lib/news-types";
import NewsCard from "./NewsCard";

interface CategoryRowProps {
  label: string;
  categoryId: string;
  items: NewsItem[]; // already capped to 2/source, max 10, newest-first
  onSeeAll: () => void;
}

export default function CategoryRow({ label, categoryId, items, onSeeAll }: CategoryRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft]   = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      ro.disconnect();
    };
  }, [updateScrollState]);

  useEffect(() => { updateScrollState(); }, [items, updateScrollState]);

  function scroll(direction: "left" | "right") {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction === "left" ? -320 : 320, behavior: prefersReduced ? "instant" : "smooth" });
  }

  if (items.length === 0) return null;

  return (
    <section aria-labelledby={`cat-${categoryId}-heading`} className="flex flex-col gap-3">
      {/* Row header */}
      <div className="flex items-center justify-between gap-4">
        <h2
          id={`cat-${categoryId}-heading`}
          className="text-base font-semibold text-text"
        >
          {label}
        </h2>
        <button
          type="button"
          onClick={onSeeAll}
          className="shrink-0 text-sm text-accent-text hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus rounded"
        >
          See all in {label} →
        </button>
      </div>

      {/* Carousel wrapper — relative so scroll buttons can be positioned */}
      <div className="relative">
        {/* Left scroll button — hidden on mobile (swipe natively) */}
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scroll("left")}
            aria-label={`Scroll ${label} left`}
            className="absolute left-0 top-1/2 z-20 hidden -translate-y-1/2 -translate-x-3 sm:flex items-center justify-center w-8 h-8 rounded-full bg-surface border border-border shadow-md text-text-muted hover:bg-surface-2 hover:text-text transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
          >
            <span aria-hidden="true" className="text-lg leading-none">‹</span>
          </button>
        )}

        {/* Right scroll button */}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scroll("right")}
            aria-label={`Scroll ${label} right`}
            className="absolute right-0 top-1/2 z-20 hidden -translate-y-1/2 translate-x-3 sm:flex items-center justify-center w-8 h-8 rounded-full bg-surface border border-border shadow-md text-text-muted hover:bg-surface-2 hover:text-text transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
          >
            <span aria-hidden="true" className="text-lg leading-none">›</span>
          </button>
        )}

        {/* Scrollable card strip */}
        <div
          ref={scrollRef}
          role="list"
          tabIndex={0}
          aria-label={`${label} articles — use arrow keys or scroll`}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") { e.preventDefault(); scroll("right"); }
            if (e.key === "ArrowLeft")  { e.preventDefault(); scroll("left"); }
          }}
          className="flex gap-4 overflow-x-auto pb-3 outline-none focus-visible:ring-2 focus-visible:ring-focus rounded"
          style={{ scrollbarWidth: "thin" }}
        >
          {items.map((item) => (
            <div
              key={item.id}
              role="listitem"
              className="w-72 shrink-0 snap-start sm:w-80"
            >
              <NewsCard item={item} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
