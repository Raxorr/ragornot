"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { navTabs, site } from "@/lib/config";
import ThemeToggle from "./ThemeToggle";
import { CloseIcon, GithubIcon, MenuIcon } from "./icons";

export default function NavBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the mobile panel on route change. Adjusting state directly during
  // render (guarded by comparing to the last-seen pathname) is the React-
  // endorsed way to reset state in response to a prop/route change, instead
  // of a useEffect that would set state after an extra render.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  // Close the mobile panel on Escape.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link
          href="/news"
          className="shrink-0 text-xl tracking-tight rounded-sm"
          aria-label={`${site.name} — home`}
        >
          <span className="font-extrabold text-text">rag</span>
          <span className="font-normal text-text-muted">ornot</span>
        </Link>

        <nav aria-label="Primary" className="hidden min-[721px]:block">
          <ul className="flex items-center gap-1">
            {navTabs.map((tab) => {
              const active = pathname?.startsWith(tab.href) ?? false;
              return (
                <li key={tab.href}>
                  <Link
                    href={tab.href}
                    aria-current={active ? "page" : undefined}
                    className={`inline-flex h-11 items-center rounded-md px-3 text-sm font-medium transition-colors ${
                      active
                        ? "text-accent-text"
                        : "text-text-muted hover:text-text"
                    }`}
                  >
                    {tab.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <a
            href={site.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="ragornot on GitHub"
            className="hidden h-11 w-11 items-center justify-center rounded-full border border-border text-text transition-colors hover:border-accent hover:text-accent-text min-[721px]:inline-flex"
          >
            <GithubIcon className="h-5 w-5" />
          </a>
          <button
            type="button"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-border text-text min-[721px]:hidden"
          >
            {open ? <CloseIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <nav id="mobile-nav" aria-label="Primary" className="border-t border-border min-[721px]:hidden">
          <ul className="flex flex-col px-4 py-2">
            {navTabs.map((tab) => {
              const active = pathname?.startsWith(tab.href) ?? false;
              return (
                <li key={tab.href}>
                  <Link
                    href={tab.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex h-12 items-center text-base font-medium ${
                      active ? "text-accent-text" : "text-text"
                    }`}
                  >
                    {tab.label}
                  </Link>
                </li>
              );
            })}
            <li className="border-t border-border py-2">
              <a
                href={site.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-12 items-center gap-2 text-base font-medium text-text"
              >
                <GithubIcon className="h-5 w-5" />
                GitHub
              </a>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
