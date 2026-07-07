"use client";

import { useState, type FormEvent } from "react";

export interface WallEntry {
  id: string;
  text: string;
  role?: string;
  approvedAt?: string;
}

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");

async function submitWall(text: string, role: string) {
  const res = await fetch(`${API_BASE}/api/wall-submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, role }),
  });
  const data = await res.json() as { success?: boolean; message?: string; error?: string };
  if (!res.ok) return { ok: false, error: data.error ?? `Request failed (${res.status})` };
  return { ok: true, message: data.message };
}

interface WallViewProps {
  entries: WallEntry[];
}

export default function WallView({ entries }: WallViewProps) {
  const [text, setText] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (text.trim().length < 20) {
      setStatus("error");
      setMsg("Please share at least a sentence (20+ characters).");
      return;
    }
    setStatus("submitting");
    const result = await submitWall(text.trim(), role.trim());
    if (result.ok) {
      setStatus("success");
      setMsg(result.message ?? "Thanks — your submission is under review.");
    } else {
      setStatus("error");
      setMsg(result.error ?? "Submission failed. Try again.");
    }
  }

  return (
    <div className="flex flex-col gap-10">
      {/* Submission form */}
      <section
        aria-labelledby="wall-submit-heading"
        className="flex flex-col gap-4 rounded-lg border border-dashed border-border bg-surface p-5 sm:p-6"
      >
        <div>
          <h2 id="wall-submit-heading" className="text-xl font-bold text-text">
            Share yours
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            Anonymous — no account, no name, no email. Up to 500 characters. Submissions are reviewed
            before appearing here. No promotion, personal info, or harmful content.
          </p>
        </div>

        {status === "success" ? (
          <p className="rounded-lg bg-surface-2 px-4 py-3 text-sm text-text">{msg}</p>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="wall-text" className="text-sm font-medium text-text">
                What&rsquo;s the most bizarre or clever AI use you&rsquo;ve seen or done at work?
              </label>
              <textarea
                id="wall-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={500}
                rows={4}
                placeholder="Describe it in plain language — no jargon required…"
                className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline focus:outline-2 focus:outline-focus"
              />
              <p className="text-xs text-text-muted">{text.length}/500</p>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="wall-role" className="text-sm font-medium text-text">
                Role / industry <span className="font-normal text-text-muted">(optional)</span>
              </label>
              <input
                id="wall-role"
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                maxLength={100}
                placeholder="e.g. ML engineer, healthcare, fintech…"
                className="w-full max-w-xs rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline focus:outline-2 focus:outline-focus"
              />
            </div>
            {status === "error" && (
              <p className="text-xs text-accent-text">{msg}</p>
            )}
            <button
              type="submit"
              disabled={status === "submitting"}
              className="inline-flex min-h-10 w-fit items-center rounded-lg bg-accent px-5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
            >
              {status === "submitting" ? "Submitting…" : "Submit anonymously"}
            </button>
          </form>
        )}
      </section>

      {/* Approved entries */}
      <section aria-labelledby="wall-entries-heading" className="flex flex-col gap-4">
        <h2 id="wall-entries-heading" className="text-xl font-bold text-text">
          In the Wild — approved
        </h2>
        {entries.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-sm text-text-muted">
            No approved entries yet — be the first to submit one above.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {entries.map((entry) => (
              <article
                key={entry.id}
                className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5"
              >
                <p className="text-sm text-text">&ldquo;{entry.text}&rdquo;</p>
                {entry.role && (
                  <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted">
                    <span className="rounded-full border border-border bg-surface-2 px-2.5 py-0.5 font-medium text-text-muted">
                      {entry.role}
                    </span>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
