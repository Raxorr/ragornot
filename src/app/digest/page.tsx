import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import type { DigestIssue } from "@/lib/digest-types";
import DigestView from "@/components/digest/DigestView";
import DigestNotify from "@/components/digest/DigestNotify";
import { absoluteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "RAG Reality Check",
  description:
    "A weekly, plain-English digest on retrieval, cost, and the real environmental footprint of AI — three things that happened, an impact stat of the week, and the RAG-or-not angle.",
  alternates: { canonical: absoluteUrl("/digest") },
};

// Render from the committed public/digest.json at build time — static and safe.
// New issues are added by editing that file (see ARCHITECTURE.md "Digest").
function loadDigest(): DigestIssue[] {
  const filePath = path.join(process.cwd(), "public", "digest.json");
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const issues = JSON.parse(raw) as DigestIssue[];
    return issues.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch {
    return [];
  }
}

export default function DigestPage() {
  const issues = loadDigest();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-10 sm:px-6 sm:py-14">
      <header className="flex flex-col gap-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-text">
          RAG Reality Check
        </p>
        <h1 className="text-4xl font-extrabold tracking-tight text-text sm:text-5xl">RAG Reality Check</h1>
        <p className="max-w-prose text-lg text-text-muted">
          A short, honest read on retrieval, cost, and the environmental footprint of AI — three things
          that happened, an impact stat you can cite, and where each lands on the &ldquo;RAG or
          not?&rdquo; question. New issues as the story moves, not on a clock. Want the raw feed instead?
          See <Link href="/news" className="underline hover:text-accent-text">News</Link>.
        </p>
      </header>

      <DigestView issues={issues} />

      <DigestNotify />
    </div>
  );
}
