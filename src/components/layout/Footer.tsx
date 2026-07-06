import { site } from "@/lib/config";
import { GithubIcon, LinkedinIcon } from "./icons";

export default function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-text-muted sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p>Built by {site.author}</p>
          <div className="flex items-center gap-5">
            <a
              href={site.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Rohit Sarna on GitHub"
              className="inline-flex min-h-11 items-center gap-1.5 hover:text-accent-text"
            >
              <GithubIcon className="h-4 w-4" />
              GitHub
            </a>
            <a
              href={site.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Rohit Sarna on LinkedIn"
              className="inline-flex min-h-11 items-center gap-1.5 hover:text-accent-text"
            >
              <LinkedinIcon className="h-4 w-4" />
              LinkedIn
            </a>
          </div>
        </div>
        <p className="text-xs">
          News feed aggregates headlines from public sources (arXiv, Hacker News, publisher RSS).
          All articles link to their original publisher. ragornot does not reproduce full article text.
          Code is MIT licensed.{" "}
          <a
            href="https://github.com/Raxorr/ragornot/blob/main/LICENSE"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-accent-text"
          >
            License
          </a>
        </p>
      </div>
    </footer>
  );
}
