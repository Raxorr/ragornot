# ragornot

Compare retrieval architectures, track real cost and latency, and follow the AI, LLM, and RAG conversation — in one place.

**Live site:** https://raxorr.github.io/ragornot

---

## What it does

ragornot runs your question through four retrieval strategies against 116 indexed AWS documentation pages, all backed by a live AWS Lambda + Bedrock backend:

| Mode | Description |
|------|-------------|
| **Flat (Lexical)** | Global BM25-style ranking across every chunk |
| **Hierarchical** | Document → section → chunk narrowing before ranking |
| **LLM-only** | Direct AWS Bedrock (Haiku) answer, no retrieval grounding |
| **RAG** | Hierarchical retrieval + Bedrock generation |

The **News** tab aggregates AI/LLM/RAG headlines from arXiv, Hacker News, and publisher RSS feeds — refreshed hourly by a free GitHub Actions cron.

---

## Local dev

```bash
cp .env.example .env.local
# Edit .env.local: set NEXT_PUBLIC_API_BASE_URL to your CloudFront domain
npm install
npm run dev
# Open http://localhost:3000
```

The app redirects `/` to `/news`. Explore is at `/explore`, Benchmark at `/benchmark`.

---

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | Yes | CloudFront domain that proxies to the Lambda backend |
| `NEXT_PUBLIC_SITE_URL` | No | Canonical site URL for OG tags and sitemap (default: GitHub Pages URL) |
| `NEXT_BASE_PATH` | Build-time | Set to `/ragornot` for GitHub Pages project repo; leave empty for custom domain |

**Security note:** the `x-origin-verify` header that protects the Lambda is injected **server-side by CloudFront** — it never appears in client code or env files.

### Lambda backend env vars (set in AWS console/CLI, never in this repo)

| Variable | Description |
|----------|-------------|
| `DATA_BUCKET` | S3 bucket for benchmark index, interest submissions, quota state |
| `BENCHMARK_KEY` | Secret key for benchmark access (user-typed, sent as header) |
| `ORIGIN_VERIFY_SECRET` | Must match the `x-origin-verify` CloudFront custom header |
| `SES_SENDER` | Verified SES address for outbound email |
| `OWNER_EMAIL` | Owner notification address for interest-form submissions |
| `SES_REGION` | AWS region where the SES identity is verified (default: us-east-1) |
| `EXPLORE_LLM_FREE_DAILY` | Max Explore AI answers per IP per day (default: 10) |
| `BENCHMARK_DAILY_LIMIT` | Max benchmark runs per IP per day |
| `BEDROCK_DAILY_USD_CAP` | Hard global Bedrock spend cap in USD per UTC day |
| `BEDROCK_MODEL_ID` | Bedrock model for LLM/RAG (e.g. claude-haiku-4-5) |

---

## News cron

The news feed lives in `public/news.json`. Updated by `.github/workflows/news-cron.yml` every hour:

1. Actions runs `npm run fetch-news`
2. If `news.json` changed, it commits and pushes to main
3. The push triggers `deploy.yml` via the push event, which rebuilds and redeploys

> **Note:** GitHub's scheduled workflows can lag 15–60 min during high load. For guaranteed hourly freshness, configure an external cron at [cron-job.org](https://cron-job.org) to POST to `https://api.github.com/repos/Raxorr/ragornot/actions/workflows/news-cron.yml/dispatches` with a GitHub PAT that has `actions:write` scope.

Local: `npm run fetch-news`

To add a source: edit `RSS_SOURCES` in `scripts/fetch-news.mjs`.

---

## Deploy to GitHub Pages

`.github/workflows/deploy.yml` handles this automatically on every push to `main`.

**One-time setup:**
1. Repo Settings → Pages → Source: **GitHub Actions**
2. Push to `main`

Build env vars set in the workflow:
```
NEXT_PUBLIC_API_BASE_URL=https://d8mkun1yo4v0c.cloudfront.net
NEXT_PUBLIC_SITE_URL=https://raxorr.github.io/ragornot
NEXT_BASE_PATH=/ragornot
```

---

## AWS backend

The Lambda backend is in a separate repo (`aws-serverless-docs-assistant`) and is treated as fixed infrastructure. Do not redeploy it from here.

**CORS:** Lambda returns `Access-Control-Allow-Origin: *` and handles OPTIONS preflights. No CORS changes needed for GitHub Pages or any new origin.

**Rate limiting:** per-IP daily limits enforced in Lambda env vars. The frontend shows a friendly message on 429.

---

## Custom domain (deferred — do after GitHub Pages is live)

1. GitHub repo Settings → Pages → Custom domain: enter your domain
2. Cloudflare/Route 53 DNS: `CNAME` pointing to `raxorr.github.io`
3. In `.github/workflows/deploy.yml`: remove `NEXT_BASE_PATH=/ragornot` and update `NEXT_PUBLIC_SITE_URL` to the new domain
4. Update `public/robots.txt` and `public/sitemap.xml` URLs
5. No CORS changes needed — Lambda already allows any origin

---

## Fonts and licensing

- **Inter** (SIL OFL 1.1) — self-hosted by `next/font/google` at build time
- **JetBrains Mono** (SIL OFL 1.1) — same
- Code: MIT (see `LICENSE`)

---

## Stack

Next.js 16 · React 19 · Tailwind CSS v4 · TypeScript · GitHub Pages · GitHub Actions
