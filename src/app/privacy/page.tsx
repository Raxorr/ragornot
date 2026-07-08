import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "How ragornot handles data: search queries are processed transiently, not stored or tied to identity; email is used only to send benchmark access keys.",
  alternates: { canonical: absoluteUrl("/privacy") },
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="mb-8 text-3xl font-bold tracking-tight text-text">Privacy Policy</h1>
      <div className="flex flex-col gap-6 text-sm text-text-muted [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-text [&_h2]:mt-2">

        <section>
          <h2>What we collect</h2>
          <ul className="mt-2 list-disc pl-5 flex flex-col gap-1">
            <li>
              <strong className="text-text">Search queries</strong> — queries you submit in the Explore
              or Benchmark tabs are sent to the backend to produce results. They are not stored
              permanently or associated with your identity.
            </li>
            <li>
              <strong className="text-text">IP address</strong> — used server-side to enforce per-IP
              rate limits (Explore AI answers and Benchmark runs). Not logged permanently.
            </li>
            <li>
              <strong className="text-text">Access request email</strong> — if you submit the
              &quot;Request access&quot; form on the Benchmark page, your email, optional name, and
              optional note are stored in AWS S3 and used only to send you an access key. We do not
              share this data with third parties or use it for marketing.
            </li>
            <li>
              <strong className="text-text">Uploaded documents</strong> — if you use the advanced
              benchmark feature to upload your own files, they are stored temporarily in AWS S3
              and automatically deleted after 7 days. They are not used for training or shared.
            </li>
          </ul>
        </section>

        <section>
          <h2>What we do not collect</h2>
          <p className="mt-2">
            We do not use cookies, analytics trackers, or advertising SDKs. We do not create
            persistent user accounts or user profiles.
          </p>
        </section>

        <section>
          <h2>Third-party services</h2>
          <ul className="mt-2 list-disc pl-5 flex flex-col gap-1">
            <li>
              <strong className="text-text">Amazon Bedrock</strong> — LLM-only and RAG queries are
              processed by AWS Bedrock (Claude Haiku). Queries are subject to{" "}
              <a
                href="https://aws.amazon.com/service-terms/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-accent-text"
              >
                AWS Service Terms
              </a>.
            </li>
            <li>
              <strong className="text-text">GitHub Pages</strong> — the static frontend is hosted on
              GitHub Pages and subject to GitHub&apos;s privacy policy.
            </li>
          </ul>
        </section>

        <section>
          <h2>Data deletion</h2>
          <p className="mt-2">
            To request deletion of your access request email, contact us via GitHub at{" "}
            <a
              href="https://github.com/Raxorr/ragornot"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-accent-text"
            >
              github.com/Raxorr/ragornot
            </a>. We will remove it within 30 days.
          </p>
        </section>

        <section>
          <h2>Changes</h2>
          <p className="mt-2">
            This policy may be updated at any time. Material changes will be noted in the project
            repository.
          </p>
        </section>

        <p className="text-xs mt-4">Last updated: July 2026</p>
      </div>
    </div>
  );
}
