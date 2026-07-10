// Feature flags.
//
// Only ONE flag remains. Every other impact/community feature (the sourced
// impact panel, /methodology, /decide, /digest, and the share cards) has shipped
// unflagged. The session self-consumption meter stays parked until the additive
// backend counter it needs exists.

export const flags = {
  /**
   * Session self-consumption meter — floating widget + per-run recording.
   * Parked OFF: a truthful cumulative meter needs a read-only cross-user counter
   * the Lambda would expose additively (see ARCHITECTURE.md, "Self-consumption
   * meter (Tier 2 — design only)"). Until that exists this stays off so we never
   * present a session-scoped number as if it were global. When off, the widget
   * doesn't mount and no per-run recording happens — a harmless no-op.
   */
  sessionMeter: false,
} as const;
