// Single source of truth for absolute URLs (canonical tags, OpenGraph/Twitter
// images, sitemap-style links). The site is served from the domain root, so
// callers pass a route like "/news" and always get a correct absolute URL —
// no hardcoded host and no base path.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://ragornot.com"
).replace(/\/$/, "");

/** Build an absolute URL for a route or asset path, e.g. absoluteUrl("/news"). */
export function absoluteUrl(routePath = "/"): string {
  if (routePath === "/" || routePath === "") return `${SITE_URL}/`;
  return `${SITE_URL}${routePath.startsWith("/") ? "" : "/"}${routePath}`;
}
