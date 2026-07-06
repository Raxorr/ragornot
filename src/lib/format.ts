export function formatRelativeTime(isoDate: string, now: Date = new Date()): string {
  const then = new Date(isoDate).getTime();
  const diffMs = now.getTime() - then;
  const diffSec = Math.round(diffMs / 1000);

  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["week", 60 * 60 * 24 * 7],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
  ];

  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, secondsInUnit] of units) {
    if (Math.abs(diffSec) >= secondsInUnit) {
      return rtf.format(Math.round(-diffSec / secondsInUnit), unit);
    }
  }
  return "just now";
}

export function formatLatency(ms: number): string {
  if (ms < 1) return "<1ms";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function formatCost(usd: number): string {
  if (usd === 0) return "$0.00000";
  return `$${usd.toFixed(5)}`;
}

export function formatEnergy(wh: number): string {
  return `${wh.toFixed(3)} Wh`;
}
