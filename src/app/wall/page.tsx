import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import WallView, { type WallEntry } from "@/components/community/WallView";

export const metadata: Metadata = {
  title: "In the Wild — ragornot",
  description:
    "Anonymous community stories: the most bizarre and clever professional uses of AI people have seen or done. Moderated before publishing.",
};

function loadWall(): WallEntry[] {
  const filePath = path.join(process.cwd(), "public", "wall.json");
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as WallEntry[];
  } catch {
    return [];
  }
}

export default function WallPage() {
  const entries = loadWall();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-10 sm:px-6 sm:py-14">
      <section className="flex flex-col gap-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-text">
          Community — anonymous
        </p>
        <h1 className="text-4xl font-extrabold tracking-tight text-text sm:text-5xl">
          In the Wild
        </h1>
        <p className="max-w-prose text-lg text-text-muted">
          The most bizarre and clever professional AI use cases people have actually seen or done —
          submitted anonymously, moderated before publishing. No names, no company, no personal data.
        </p>
      </section>

      <WallView entries={entries} />
    </div>
  );
}
