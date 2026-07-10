"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { submitDigestInterest } from "@/lib/api";

// Lightweight "notify me" capture for the digest. Reuses the existing
// interest/SES endpoint (tagged source: "digest") — a low-commitment way to
// gauge whether people want new issues before promising a cadence.
export default function DigestNotify() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("submitting");
    const result = await submitDigestInterest(email.trim());
    if (result.ok) {
      setStatus("success");
      // Explicit digest-appropriate message — do NOT reuse the Lambda's returned
      // text, which is the benchmark-access-key copy ("we'll email you a key").
      setMessage("Thanks — we'll email you when the next issue drops.");
    } else {
      setStatus("error");
      setMessage(result.error ?? "Something went wrong. Try again in a bit.");
    }
  }

  return (
    <section
      aria-labelledby="digest-notify-heading"
      className="flex flex-col gap-3 rounded-lg border border-dashed border-border bg-surface p-5"
    >
      <h2 id="digest-notify-heading" className="text-base font-semibold text-text">
        Get notified when the next issue drops
      </h2>
      <p className="text-sm text-text-muted">
        No fixed schedule — new issues land as the story moves. Leave your email and we&apos;ll ping you
        when one does. Used only for that; see the{" "}
        <Link href="/privacy" className="underline hover:text-accent-text">Privacy Policy</Link>.
      </p>
      {status === "success" ? (
        <p className="rounded-lg bg-surface-2 px-4 py-3 text-sm text-text">{message}</p>
      ) : (
        <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            aria-label="Email address"
            className="min-h-11 w-full max-w-sm rounded-lg border border-border bg-surface-2 px-3 text-sm text-text placeholder:text-text-muted focus:outline focus:outline-2 focus:outline-focus"
          />
          <button
            type="submit"
            disabled={status === "submitting"}
            className="inline-flex min-h-11 w-fit items-center rounded-lg bg-accent px-5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
          >
            {status === "submitting" ? "Submitting…" : "Notify me"}
          </button>
        </form>
      )}
      {status === "error" && <p className="text-xs text-accent-text">{message}</p>}
    </section>
  );
}
