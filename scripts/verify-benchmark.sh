#!/usr/bin/env bash
# verify-benchmark.sh — assert the Benchmark API works correctly from raxorr.github.io.
# Usage: BENCHMARK_KEY=<key> bash scripts/verify-benchmark.sh
# Exit 0 = all PASS. Exit 1 = one or more FAIL.
#
# Checks:
#   1. quota_check returns quota info without consuming a run.
#   2. Full 4-mode run (shared run_id) succeeds with no benchmark-key error.
#   3. Daily counter increments by exactly 1 (not 4×) across all mode calls.
#   4. Immediate second run (new run_id) is blocked with cooldown info.
#   5. /api/upload* OPTIONS+POST each carry exactly one Access-Control-Allow-Origin.
#   6. Explore plain search (no benchmark flag) still works — confirms we didn't break it.

# No set -e: we track failures ourselves; arithmetic on "?" would abort early.
set -uo pipefail

ORIGIN="https://raxorr.github.io"
API_BASE="https://d8mkun1yo4v0c.cloudfront.net"
API_URL="${API_BASE}/api/search"
UPLOAD_URL="${API_BASE}/api/upload"
BM_KEY="${BENCHMARK_KEY:-}"
MAX_ATTEMPTS=18
SLEEP_S=10
OVERALL_PASS=true

green()  { printf '\033[32m%s\033[0m\n' "$*"; }
red()    { printf '\033[31m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }

assert_eq() {
  local label="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then
    green "  PASS $label: '$actual'"
  else
    red   "  FAIL $label: expected '$expected', got '$actual'"
    OVERALL_PASS=false
  fi
}

assert_count() {
  local label="$1" expected="$2" actual="$3"
  if [ "$actual" -eq "$expected" ] 2>/dev/null; then
    green "  PASS $label: count=$actual"
  else
    red   "  FAIL $label: expected count=$expected, got count='$actual'"
    OVERALL_PASS=false
  fi
}

assert_gt() {
  local label="$1" threshold="$2" actual="$3"
  if [ "$actual" -gt "$threshold" ] 2>/dev/null; then
    green "  PASS $label: $actual > $threshold"
  else
    red   "  FAIL $label: expected > $threshold, got '$actual'"
    OVERALL_PASS=false
  fi
}

is_int() { echo "$1" | grep -qE '^[0-9]+$'; }

if [ -z "$BM_KEY" ]; then
  red "ERROR: Set BENCHMARK_KEY env var before running."
  exit 1
fi

echo ""
yellow "════════════════════════════════════════════"
yellow "  ragornot Benchmark Verification Suite"
yellow "════════════════════════════════════════════"

# ─── Check 1: quota_check ────────────────────────────────────────────────────
yellow ""
yellow "━━━ Check 1: quota_check returns quota without consuming a run ━━━"

QUOTA_RESP=$(curl -s -X POST "$API_URL" \
  -H "Origin: $ORIGIN" \
  -H "Content-Type: application/json" \
  -H "X-Benchmark-Key: $BM_KEY" \
  -H "X-Benchmark-Mode: normal" \
  --data '{"benchmark":true,"quota_check":true}' 2>/dev/null)

echo "  Raw quota response: $QUOTA_RESP"

QUOTA_ERR=$(echo "$QUOTA_RESP" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); e=d.get('error'); print(e if e else '')" 2>/dev/null || echo "PARSE_ERROR")

if [ -z "$QUOTA_ERR" ] || [ "$QUOTA_ERR" = "None" ] || [ "$QUOTA_ERR" = "null" ]; then
  green "  PASS quota_check: no error"
else
  red   "  FAIL quota_check: error='$QUOTA_ERR'"
  OVERALL_PASS=false
fi

REMAINING_BEFORE=$(echo "$QUOTA_RESP" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); q=d.get('quota') or {}; print(q.get('remaining_runs','MISSING'))" 2>/dev/null || echo "MISSING")

if is_int "$REMAINING_BEFORE"; then
  green "  PASS quota.remaining_runs=$REMAINING_BEFORE"
else
  red   "  FAIL quota.remaining_runs missing or non-integer: '$REMAINING_BEFORE'"
  OVERALL_PASS=false
  REMAINING_BEFORE="0"
fi

if [ "$REMAINING_BEFORE" = "0" ]; then
  yellow "  WARN: remaining_runs=0; daily limit already reached. Skipping run checks (3+4)."
fi

# ─── Check 2 + 3: 4-mode run + counter increments by 1 ──────────────────────
if [ "$REMAINING_BEFORE" != "0" ]; then
  yellow ""
  yellow "━━━ Check 2: 4-mode benchmark run with shared run_id ━━━"

  RUN_ID="verify-$(date +%s)"
  TEST_Q="How do I give a Lambda function access to S3?"

  for mode in flat hierarchical llm rag; do
    RESP=$(curl -s -X POST "$API_URL" \
      -H "Origin: $ORIGIN" \
      -H "Content-Type: application/json" \
      -H "X-Benchmark-Key: $BM_KEY" \
      -H "X-Benchmark-Mode: normal" \
      --data "{\"q\":\"$TEST_Q\",\"mode\":\"$mode\",\"benchmark\":true,\"run_id\":\"$RUN_ID\"}" \
      2>/dev/null)

    ERR_FIELD=$(echo "$RESP" | python3 -c \
      "import sys,json; d=json.load(sys.stdin); e=d.get('error'); print(e if e else '')" 2>/dev/null || echo "PARSE_ERROR")

    if [ -z "$ERR_FIELD" ] || [ "$ERR_FIELD" = "None" ] || [ "$ERR_FIELD" = "null" ]; then
      green "  PASS mode=$mode: no error"
    else
      red   "  FAIL mode=$mode: error='$ERR_FIELD'"
      OVERALL_PASS=false
    fi

    # Capture answer_bullets to verify real content returned
    if [ "$mode" = "flat" ]; then
      BULLET_COUNT=$(echo "$RESP" | python3 -c \
        "import sys,json; d=json.load(sys.stdin); print(len(d.get('answer_bullets') or []))" 2>/dev/null || echo "0")
      assert_gt "flat mode answer_bullets count" 0 "$BULLET_COUNT"
    fi
  done

  yellow ""
  yellow "━━━ Check 3: counter incremented by exactly 1 (not 4) ━━━"

  QUOTA_RESP2=$(curl -s -X POST "$API_URL" \
    -H "Origin: $ORIGIN" \
    -H "Content-Type: application/json" \
    -H "X-Benchmark-Key: $BM_KEY" \
    -H "X-Benchmark-Mode: normal" \
    --data '{"benchmark":true,"quota_check":true}' 2>/dev/null)

  REMAINING_AFTER=$(echo "$QUOTA_RESP2" | python3 -c \
    "import sys,json; d=json.load(sys.stdin); q=d.get('quota') or {}; print(q.get('remaining_runs','?'))" 2>/dev/null || echo "?")
  RUNS_USED=$(echo "$QUOTA_RESP2" | python3 -c \
    "import sys,json; d=json.load(sys.stdin); q=d.get('quota') or {}; print(q.get('runs_used','?'))" 2>/dev/null || echo "?")

  echo "  remaining_runs: before=$REMAINING_BEFORE  after=$REMAINING_AFTER"
  echo "  runs_used now : $RUNS_USED"

  if is_int "$REMAINING_BEFORE" && is_int "$REMAINING_AFTER"; then
    DECREMENT=$(( REMAINING_BEFORE - REMAINING_AFTER ))
    if [ "$DECREMENT" -eq 1 ]; then
      green "  PASS counter incremented by exactly 1 (4 mode sub-calls = 1 run)"
    else
      red   "  FAIL counter changed by $DECREMENT (expected 1)"
      OVERALL_PASS=false
    fi
  else
    red   "  FAIL cannot compute decrement: before='$REMAINING_BEFORE' after='$REMAINING_AFTER'"
    OVERALL_PASS=false
  fi

  # ─── Check 4: immediate second run is blocked by cooldown ─────────────────
  yellow ""
  yellow "━━━ Check 4: immediate second run blocked by ≥1h cooldown ━━━"

  RUN_ID2="verify2-$(date +%s)"
  BLOCK_RESP=$(curl -s -X POST "$API_URL" \
    -H "Origin: $ORIGIN" \
    -H "Content-Type: application/json" \
    -H "X-Benchmark-Key: $BM_KEY" \
    -H "X-Benchmark-Mode: normal" \
    --data "{\"q\":\"$TEST_Q\",\"mode\":\"flat\",\"benchmark\":true,\"run_id\":\"$RUN_ID2\"}" \
    2>/dev/null)

  BLOCK_ERR=$(echo "$BLOCK_RESP" | python3 -c \
    "import sys,json; d=json.load(sys.stdin); e=d.get('error'); print(e if e else '')" 2>/dev/null || echo "?")
  COOLDOWN_SECS=$(echo "$BLOCK_RESP" | python3 -c \
    "import sys,json; d=json.load(sys.stdin); q=d.get('quota') or {}; print(int(q.get('seconds_until_next',0)))" 2>/dev/null || echo "0")

  echo "  Block error    : $BLOCK_ERR"
  echo "  Cooldown secs  : $COOLDOWN_SECS"

  if [ -n "$BLOCK_ERR" ] && [ "$BLOCK_ERR" != "None" ] && [ "$BLOCK_ERR" != "null" ] && [ "$BLOCK_ERR" != "" ]; then
    green "  PASS second run blocked: '$BLOCK_ERR'"
  else
    red   "  FAIL second run was NOT blocked (expected cooldown/daily-limit error)"
    OVERALL_PASS=false
  fi

  assert_gt "cooldown seconds_until_next" 0 "$COOLDOWN_SECS"
fi

# ─── Check 5: /api/upload* CORS ──────────────────────────────────────────────
yellow ""
yellow "━━━ Check 5: /api/upload* CORS — single ACAO on OPTIONS + POST ━━━"

UPLOAD_PASS=false
for attempt in $(seq 1 $MAX_ATTEMPTS); do
  yellow "  attempt $attempt / $MAX_ATTEMPTS …"
  pass_cors=true

  OPT_RESP=$(curl -s -i -X OPTIONS "$UPLOAD_URL" \
    -H "Origin: $ORIGIN" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: content-type" 2>/dev/null)

  OPT_ACAO=$(echo "$OPT_RESP" | grep -i '^access-control-allow-origin:' | wc -l | tr -d ' ')
  OPT_ACAO_VAL=$(echo "$OPT_RESP" | grep -i '^access-control-allow-origin:' | tail -1 | awk '{$1=""; print $0}' | tr -d ' \r')
  OPT_STATUS=$(echo "$OPT_RESP" | grep -i '^HTTP' | tail -1 | awk '{print $2}')

  echo "  [OPTIONS] status=$OPT_STATUS  ACAO×$OPT_ACAO='$OPT_ACAO_VAL'"

  if [ "$OPT_ACAO" -eq 0 ] 2>/dev/null; then
    yellow "  OPTIONS ACAO missing — CloudFront still propagating, retrying…"
    pass_cors=false
  else
    assert_count "OPTIONS ACAO count" 1 "$OPT_ACAO"
    assert_eq    "OPTIONS ACAO value" "*" "$OPT_ACAO_VAL"
  fi

  # Probe POST with an empty-files payload (expect 400 body, but CORS must be correct)
  POST_RESP=$(curl -s -i -X POST "$UPLOAD_URL" \
    -H "Origin: $ORIGIN" \
    -H "Content-Type: application/json" \
    --data '{"files":[]}' 2>/dev/null)

  POST_ACAO=$(echo "$POST_RESP" | grep -i '^access-control-allow-origin:' | wc -l | tr -d ' ')
  POST_ACAO_VAL=$(echo "$POST_RESP" | grep -i '^access-control-allow-origin:' | tail -1 | awk '{$1=""; print $0}' | tr -d ' \r')
  POST_STATUS=$(echo "$POST_RESP" | grep -i '^HTTP' | tail -1 | awk '{print $2}')

  echo "  [POST]    status=$POST_STATUS  ACAO×$POST_ACAO='$POST_ACAO_VAL'"

  if [ "$POST_ACAO" -eq 0 ] 2>/dev/null; then
    yellow "  POST ACAO missing — retrying…"
    pass_cors=false
  else
    assert_count "POST ACAO count" 1 "$POST_ACAO"
    assert_eq    "POST ACAO value" "*" "$POST_ACAO_VAL"
  fi

  if $pass_cors; then
    green "  ✓ /api/upload* CORS PASSED on attempt $attempt"
    UPLOAD_PASS=true
    break
  fi

  if [ "$attempt" -lt "$MAX_ATTEMPTS" ]; then
    yellow "  Retrying in ${SLEEP_S}s…"
    sleep $SLEEP_S
  fi
done

if ! $UPLOAD_PASS; then
  red "  ✗ /api/upload* CORS FAILED after $MAX_ATTEMPTS attempts"
  OVERALL_PASS=false
fi

# ─── Check 6: Explore plain search still works ───────────────────────────────
yellow ""
yellow "━━━ Check 6: Explore plain search (no benchmark flag) ━━━"

EXPLORE_RESP=$(curl -s -X POST "$API_URL" \
  -H "Origin: $ORIGIN" \
  -H "Content-Type: application/json" \
  --data '{"q":"How do I enable static website hosting on S3?","mode":"flat"}' 2>/dev/null)

EXPLORE_ERR=$(echo "$EXPLORE_RESP" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); e=d.get('error'); print(e if e else '')" 2>/dev/null || echo "PARSE_ERROR")
EXPLORE_BULLETS=$(echo "$EXPLORE_RESP" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(len(d.get('answer_bullets') or []))" 2>/dev/null || echo "0")
EXPLORE_ACAO=$(curl -s -i -X POST "$API_URL" \
  -H "Origin: $ORIGIN" -H "Content-Type: application/json" \
  --data '{"q":"test","mode":"flat"}' 2>/dev/null | grep -i '^access-control-allow-origin:' | wc -l | tr -d ' ')

if [ -z "$EXPLORE_ERR" ] || [ "$EXPLORE_ERR" = "None" ] || [ "$EXPLORE_ERR" = "null" ]; then
  green "  PASS Explore: no error"
else
  red   "  FAIL Explore: error='$EXPLORE_ERR'"
  OVERALL_PASS=false
fi

assert_gt "Explore answer_bullets count" 0 "$EXPLORE_BULLETS"
assert_count "Explore ACAO count (CORS still single)" 1 "$EXPLORE_ACAO"

# ─── Summary ─────────────────────────────────────────────────────────────────
echo ""
if $OVERALL_PASS; then
  green "══════════════════════════════════"
  green "  ALL BENCHMARK CHECKS PASSED"
  green "══════════════════════════════════"
  exit 0
else
  red   "══════════════════════════════════"
  red   "  ONE OR MORE CHECKS FAILED"
  red   "══════════════════════════════════"
  exit 1
fi
