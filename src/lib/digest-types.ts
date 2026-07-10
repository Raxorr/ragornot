// Types for the /digest "RAG Reality Check" — a weekly, readable summary
// rendered from the committed public/digest.json (static + safe).

export interface DigestThing {
  /** Headline of the thing that happened. */
  title: string;
  /** 1–2 line plain-English take. */
  take: string;
  /** Link to the source. */
  link: string;
}

export interface DigestStat {
  /** The number, e.g. "~100×". */
  value: string;
  /** What it measures, e.g. "more energy: stuffing a long doc into context vs retrieving". */
  label: string;
  /** Short citation. */
  source: string;
  sourceUrl: string;
}

export interface DigestIssue {
  /** Stable slug / anchor, e.g. "2026-07-06". */
  slug: string;
  /** ISO date (issue date). */
  date: string;
  /** Issue title, e.g. "RAG Reality Check — Week of Jul 6, 2026". */
  title: string;
  /** Optional one-line intro. */
  intro?: string;
  /** "3 things that happened." */
  things: DigestThing[];
  /** Permanent "impact stat of the week." */
  stat: DigestStat;
  /** Short "RAG-or-not angle." */
  ragOrNotAngle: string;
  /** One community question — ties into the Wall. */
  communityQuestion: string;
}
