import Link from "next/link";
import type { DigestIssue } from "@/lib/digest-types";

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function DigestView({ issues }: { issues: DigestIssue[] }) {
  if (issues.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-surface px-4 py-6 text-sm text-text-muted">
        The first issue is on its way. Check back soon.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-12">
      {issues.map((issue) => (
        <article
          key={issue.slug}
          id={issue.slug}
          className="flex scroll-mt-20 flex-col gap-6 rounded-lg border border-border bg-surface p-5 sm:p-8"
        >
          <header className="flex flex-col gap-2">
            <time dateTime={issue.date} className="font-mono text-xs uppercase tracking-wide text-accent-text">
              {fmtDate(issue.date)}
            </time>
            <h2 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">{issue.title}</h2>
            {issue.intro && <p className="max-w-prose text-text-muted">{issue.intro}</p>}
          </header>

          {/* 3 things that happened */}
          <section aria-label="Three things that happened" className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
              3 things that happened
            </h3>
            <ol className="flex flex-col gap-4">
              {issue.things.map((thing, i) => (
                <li key={i} className="flex gap-3">
                  <span aria-hidden="true" className="font-mono text-sm font-bold text-accent-text">{i + 1}</span>
                  <div className="flex flex-col gap-1">
                    <a
                      href={thing.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-text underline decoration-transparent underline-offset-2 transition-colors hover:decoration-accent-text hover:text-accent-text"
                    >
                      {thing.title}
                    </a>
                    <p className="text-sm text-text-muted">{thing.take}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* Impact stat of the week */}
          <div className="flex flex-col gap-2 rounded-lg border border-accent/40 bg-surface-2 p-5">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-text">
              Impact stat of the week
            </span>
            <p className="text-text">
              <span className="font-mono text-3xl font-bold text-text">{issue.stat.value}</span>{" "}
              <span className="text-text-muted">{issue.stat.label}</span>
            </p>
            <a
              href={issue.stat.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-accent-text underline decoration-dotted underline-offset-2 hover:text-accent"
            >
              {issue.stat.source}
            </a>
          </div>

          {/* RAG-or-not angle */}
          <section aria-label="The RAG-or-not angle" className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">The RAG-or-not angle</h3>
            <p className="max-w-prose text-text">{issue.ragOrNotAngle}</p>
          </section>

          {/* Community question — ties into the Wall */}
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-2 p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Your turn</h3>
            <p className="text-text">{issue.communityQuestion}</p>
            <Link
              href="/wall"
              className="inline-flex w-fit min-h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
            >
              Share your answer →
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}
