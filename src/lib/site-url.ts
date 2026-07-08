// Single source of truth for absolute URLs (canonical tags, OpenGraph/Twitter
// images, sitemap-style links). NEXT_PUBLIC_SITE_URL already carries the base
// path on GitHub Pages (…/ragornot) and becomes the bare domain after the
// custom-domain switch, so callers pass a route like "/news" and always get a
// correct absolute URL — no hardcoded host and no hardcoded base path.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://raxorr.github.io/ragornot"
).replace(/\/$/, "");

/** Build an absolute URL for a route or asset path, e.g. absoluteUrl("/news"). */
export function absoluteUrl(routePath = "/"): string {
  if (routePath === "/" || routePath === "") return `${SITE_URL}/`;
  return `${SITE_URL}${routePath.startsWith("/") ? "" : "/"}${routePath}`;
}
