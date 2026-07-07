interface InfoTooltipProps {
  tip: string;
  side?: "top" | "bottom";
}

/**
 * Small accessible ? badge that shows a tooltip on hover/focus.
 * Uses CSS group-hover so no JS state is needed.
 */
export default function InfoTooltip({ tip, side = "top" }: InfoTooltipProps) {
  const posClass =
    side === "top"
      ? "bottom-full mb-2"
      : "top-full mt-2";

  return (
    <span className="group/tip relative inline-flex shrink-0">
      <button
        type="button"
        aria-label={tip}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border text-[10px] font-bold leading-none text-text-muted transition-colors hover:border-accent hover:text-accent-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
      >
        ?
      </button>
      <span
        role="tooltip"
        className={[
          "pointer-events-none absolute left-1/2 z-50 w-56 -translate-x-1/2 rounded-lg border border-border bg-surface px-3 py-2 text-xs leading-relaxed text-text-muted shadow-lg",
          "opacity-0 transition-opacity group-hover/tip:opacity-100 group-focus-within/tip:opacity-100",
          posClass,
        ].join(" ")}
      >
        {tip}
      </span>
    </span>
  );
}
