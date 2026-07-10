# Architecture

A one-page tour of how ragornot is built and *why* — the request lifecycle, the key
design decisions, and the tradeoffs behind them.

## System shape

```
Browser ──► GitHub Pages (static Next.js export)         [UI, cached at the edge]
   │
   └──► CloudFront ──► Lambda Function URL ──► Bedrock    [generation]
                            │        └──────► in-Lambda BM25 over 116 AWS docs
                            └──────► S3   [index · rate state · cost counter · submissions]
                            └──────► SES  [owner notifications]
```

The frontend is a **static export** (`output: "export"`) served by GitHub Pages. There is
no Node server in production. Every dynamic capability — retrieval, generation, rate
limiting, email — lives behind a single AWS Lambda Function URL fronted by CloudFront.

## Request lifecycle

1. **Static page load.** GitHub Pages serves pre-rendered HTML/CSS/JS. The News tab hydrates,
   then re-fetches the committed `news.json` from GitHub raw at runtime (cache-busted) so a
   refresh shows the latest hourly cron commit without a rebuild.
2. **API call.** Benchmark/Explore/Wall requests `POST` to CloudFront (`NEXT_PUBLIC_API_BASE_URL`),
   never to the Lambda directly.
3. **Origin verification.** CloudFront attaches a secret `x-origin-verify` header
   (configured as a CloudFront origin custom header). The Lambda compares it to
   `ORIGIN_VERIFY_SECRET` and returns 403 on mismatch. The secret is never in the client
   bundle, so the public Function URL can't be abused directly.
4. **Rate + cost gates.** The Lambda checks S3-backed per-IP daily counters and a global
   daily Bedrock USD cap before doing any paid work. If a gate trips, it returns 429 with a
   friendly, retry-aware message.
5. **Retrieval / generation.** Flat and Hierarchical run BM25 entirely inside the Lambda
   (no external calls, ~single-digit ms). LLM-only and RAG call AWS Bedrock (Claude Haiku);
   RAG first retrieves grounding chunks, then generates.
6. **Response.** Latency is measured in the browser around the full `fetch()`; the Lambda
   returns the answer plus `llm_stats` (token cost) and a `quality_proxy` used for the
   winner logic and the impact analytics.

## Key decisions and tradeoffs

**Static frontend + serverless backend.**
*Why:* near-zero idle cost, trivial scaling, and no infrastructure to patch. GitHub Pages is
free and globally cached; Lambda bills per invocation.
*Tradeoff:* no server-side rendering of dynamic data — hence the runtime `news.json` fetch to
keep the feed fresh without a rebuild. Cold starts are acceptable for this workload.

**Origin verification instead of per-origin CORS.**
*Why:* a static site can be served from GitHub Pages today and a custom domain tomorrow, so
pinning CORS to a single origin is brittle. Instead CORS stays open (`*`) and access is
gated by a secret header only CloudFront can add.
*Tradeoff:* relies on the secret staying server-side — enforced by never referencing it in
client code or env files, and rotatable via the CloudFront custom header + Lambda env var.

**Cost bounded by construction.**
*Why:* a public, keyless generative endpoint is a standing bill risk. Defence in depth:
per-IP S3 rate limits, a hard global daily Bedrock USD cap that short-circuits generation for
the rest of the UTC day, plus AWS-side WAF rate rules, AWS Budgets alerts, and Lambda
reserved concurrency.
*Tradeoff:* a burst of legitimate traffic can hit the daily cap and temporarily disable
generative modes — an intentional fail-safe (lexical modes stay up and are always free).

**News freshness via cron + runtime fetch.**
*Why:* the feed should update hourly without a human and appear on refresh without waiting on
a Pages deploy. A GitHub Actions cron commits `news.json`; the client reads it from GitHub
raw at load time.
*Tradeoff:* GitHub's scheduler can lag under load, and GitHub raw has a ~5-minute edge cache
— both well within an hourly cadence.

**Moderated community wall.**
*Why:* anonymous free-text submission is an abuse and legal risk, so nothing is
auto-published. Submissions are validated, profanity-filtered, rate-limited, stored to S3,
and emailed to the owner; approval is a deliberate manual step.
*Tradeoff:* approval latency in exchange for safety — the right call for user-generated content.

**Self-consumption meter (Tier 2 — design only, not built).**
*Why:* the site shows a Tier-1 meter that accumulates estimated energy/water/CO₂ from the real
per-run token data of the current browser session (React state, resets on refresh — see
`src/lib/session-impact.tsx`). A *cumulative, cross-user* meter is a natural next step but must not
put the live Lambda at risk.
*Design (additive, non-breaking):* the Lambda already persists a daily Bedrock cost counter in S3.
Extend that record with cumulative `total_tokens` / `total_energy_wh`, and add a **read-only**
`GET /api/impact` returning `{ total_tokens, total_energy_wh, since }`. The frontend widget would
prefer that global number when the endpoint exists and gracefully fall back to the Tier-1 session
estimate when it doesn't — gated behind a feature flag. No existing endpoint changes shape; the new
route is read-only and cache-friendly (short TTL). Until then, the Lambda is treated as read-only and
untouched.

**Digest ("RAG Reality Check") — static, manual weekly draft.**
*Why:* the digest is a curated, human-authored read, not an automated feed. Rendering it from a
committed `public/digest.json` keeps it static, reviewable, and safe — the same pattern as `news.json`
and `wall.json`. Cadence is deliberately **not** fixed ("new issues as the story moves"), so the page
never reads as abandoned when a week passes without one. A "notify me" form (`DigestNotify`) captures
interest by reusing the existing benchmark-interest/SES endpoint tagged `source: "digest"` — no new
backend — so the owner can gauge demand before committing to a schedule.
*How to add an issue:* prepend a new object to the `public/digest.json` array (newest first) with a
`slug`, `date`, `title`, three `things` (title + take + link), an `impact stat` (ideally derived from
`src/lib/impact-data.ts` so it stays cited), a `ragOrNotAngle`, and a `communityQuestion`. Commit it;
the page rebuilds statically. A light workflow *could* draft an entry from the existing news feed for
the owner to edit, but that is deliberately **not** built here — it would add moving parts, and it must
never modify the existing hourly `news-cron`. For now drafting is a documented manual step.

## Repository layout

- `src/app/` — routes (`benchmark`, `explore`, `decide`, `news`, `digest`, `wall`, `methodology`, `privacy`, `terms`) + root layout/metadata
- `src/components/` — UI by feature area (`benchmark`, `explore`, `decide`, `digest`, `impact`, `share`, `news`, `community`, `layout`, `ui`)
- `src/lib/` — shared helpers (API client, formatting, site-URL builder, config, search, `flags`, `impact-data`, `decide-logic`, `session-impact`, `share-card`, `digest-types`)
- `scripts/` — `fetch-news.mjs` (news cron), `generate-og-image.mjs` (social card)
- `.github/workflows/` — `deploy.yml` (Pages) and `news-cron.yml` (hourly feed)
- `public/` — static assets, `news.json`, `wall.json`, `digest.json`, `sitemap.xml`, `llms.txt`

## Feature flags

`src/lib/flags.ts` gates the impact/community feature set. New standalone routes
(`/methodology`, `/decide`, `/digest`) default on — they can't affect existing tabs. In-place
modifications to existing surfaces default **off** so a merge can never regress the live site:
`impactV2` (the sourced Benchmark impact panel), `sessionMeter` (the floating self-consumption
meter), and `shareCards` (the share card on the Benchmark results). Flip a flag to `true` and rebuild
to ship it.
