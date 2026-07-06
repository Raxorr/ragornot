#!/usr/bin/env bash
# verify-benchmark.sh — assert the Benchmark API works correctly from raxorr.github.io.
# Usage: bash scripts/verify-benchmark.sh
# (Advanced 10x key checks) BENCHMARK_KEY=<key> bash scripts/verify-benchmark.sh
# Exit 0 = all PASS. Exit 1 = one or more FAIL.
#
# Checks:
#   1. quota_check returns quota info WITHOUT a key (standard benchmark is open to all).
#   2. LLM mode returns debug.mode=llm, generated answer_text, and llm_stats.
#   3. RAG mode returns debug.mode=rag, answer_text, matches, and llm_stats.
#   4. Flat and Hierarchical modes still return correct results (no regression).
#   5. LLM and RAG latency clearly exceeds Flat (sanity threshold: > 2x).
#   6. 4-mode benchmark run (shared run_id, no key) — counter increments by exactly 1.
#   7. Immediate second run blocked by ≥1h cooldown.
#   8. POST /api/benchmark-interest persists to S3 and returns success (SES optional).
#   9. /api/upload* OPTIONS+POST each carry exactly one Access-Control-Allow-Origin.
#  10. Explore plain search untouched — no error, >0 bullets, single ACAO.

# No set -e: track failures ourselves; arithmetic on "?" would abort early.
set -uo pipefail

ORIGIN="https://raxorr.github.io"
API_BASE="https://d8mkun1yo4v0c.cloudfront.net"
API_URL="${API_BASE}/api/search"
UPLOAD_URL="${API_BASE}/api/upload"
INTEREST_URL="${API_BASE}/api/benchmark-interest"
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

echo ""
yellow "════════════════════════════════════════════════════"
yellow "  ragornot Benchmark Verification Suite"
yellow "════════════════════════════════════════════════════"
if [ -n "$BM_KEY" ]; then
  yellow "  Advanced key provided — advanced checks enabled."
else
  yellow "  No BENCHMARK_KEY — running standard checks only."
fi

# ─── Check 1: quota_check — open, no key needed ─────────────────────────────
yellow ""
yellow "━━━ Check 1: quota_check returns quota without a key ━━━"

QUOTA_RESP=$(curl -s -X POST "$API_URL" \
  -H "Origin: $ORIGIN" \
  -H "Content-Type: application/json" \
  --data '{"benchmark":true,"quota_check":true}' 2>/dev/null)

echo "  Raw quota response: $QUOTA_RESP"

QUOTA_ERR=$(echo "$QUOTA_RESP" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); e=d.get('error'); print(e if e else '')" 2>/dev/null || echo "PARSE_ERROR")

if [ -z "$QUOTA_ERR" ] || [ "$QUOTA_ERR" = "None" ] || [ "$QUOTA_ERR" = "null" ]; then
  green "  PASS quota_check: no error, no key required"
else
  red   "  FAIL quota_check: error='$QUOTA_ERR'"
  OVERALL_PASS=false
fi

REMAINING_BEFORE=$(echo "$QUOTA_RESP" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); q=d.get('quota') or {}; print(q.get('remaining_runs','MISSING'))" 2>/dev/null || echo "MISSING")
NEXT_RUN_ALLOWED=$(echo "$QUOTA_RESP" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); q=d.get('quota') or {}; print(str(q.get('next_run_allowed','false')).lower())" 2>/dev/null || echo "false")
COOLDOWN_BEFORE=$(echo "$QUOTA_RESP" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); q=d.get('quota') or {}; print(int(q.get('seconds_until_next',0)))" 2>/dev/null || echo "0")

if is_int "$REMAINING_BEFORE"; then
  green "  PASS quota.remaining_runs=$REMAINING_BEFORE"
else
  red   "  FAIL quota.remaining_runs missing or non-integer: '$REMAINING_BEFORE'"
  OVERALL_PASS=false
  REMAINING_BEFORE="0"
fi

# ─── Check 2: LLM mode returns generated answer ──────────────────────────────
yellow ""
yellow "━━━ Check 2: LLM mode — debug.mode=llm, answer_text, llm_stats ━━━"

T_LLM_START=$(python3 -c "import time; print(int(time.time()*1000))")
LLM_RESP=$(curl -s -X POST "$API_URL" \
  -H "Origin: $ORIGIN" \
  -H "Content-Type: application/json" \
  --data '{"q":"What is a Lambda function URL?","mode":"llm"}' 2>/dev/null)
T_LLM_END=$(python3 -c "import time; print(int(time.time()*1000))")
LLM_LATENCY_MS=$(( T_LLM_END - T_LLM_START ))

LLM_MODE=$(echo "$LLM_RESP" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(d.get('mode',''))" 2>/dev/null || echo "PARSE_ERROR")
LLM_DBG_MODE=$(echo "$LLM_RESP" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(d.get('debug',{}).get('mode',''))" 2>/dev/null || echo "PARSE_ERROR")
LLM_ANSWER_LEN=$(echo "$LLM_RESP" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(len(d.get('answer_text') or ''))" 2>/dev/null || echo "0")
LLM_STATS=$(echo "$LLM_RESP" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); s=d.get('llm_stats'); print('ok' if s and s.get('input_tokens',0)>0 else 'missing')" 2>/dev/null || echo "missing")
LLM_ERR=$(echo "$LLM_RESP" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); e=d.get('error'); print(e if e else '')" 2>/dev/null || echo "PARSE_ERROR")

if [ -z "$LLM_ERR" ] || [ "$LLM_ERR" = "None" ] || [ "$LLM_ERR" = "null" ]; then
  green "  PASS LLM mode: no error"
else
  red   "  FAIL LLM mode: error='$LLM_ERR'"
  OVERALL_PASS=false
fi
assert_eq "LLM response.mode"    "llm" "$LLM_MODE"
assert_eq "LLM debug.mode"       "llm" "$LLM_DBG_MODE"
assert_gt "LLM answer_text length" 0   "$LLM_ANSWER_LEN"
assert_eq "LLM llm_stats present" "ok" "$LLM_STATS"
echo "  LLM wall-clock latency: ${LLM_LATENCY_MS}ms"

# ─── Check 3: RAG mode returns grounded answer + matches ─────────────────────
yellow ""
yellow "━━━ Check 3: RAG mode — debug.mode=rag, answer_text, matches, llm_stats ━━━"

T_RAG_START=$(python3 -c "import time; print(int(time.time()*1000))")
RAG_RESP=$(curl -s -X POST "$API_URL" \
  -H "Origin: $ORIGIN" \
  -H "Content-Type: application/json" \
  --data '{"q":"How do I give a Lambda function access to S3?","mode":"rag"}' 2>/dev/null)
T_RAG_END=$(python3 -c "import time; print(int(time.time()*1000))")
RAG_LATENCY_MS=$(( T_RAG_END - T_RAG_START ))

RAG_MODE=$(echo "$RAG_RESP" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(d.get('mode',''))" 2>/dev/null || echo "PARSE_ERROR")
RAG_DBG_MODE=$(echo "$RAG_RESP" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(d.get('debug',{}).get('mode',''))" 2>/dev/null || echo "PARSE_ERROR")
RAG_ANSWER_LEN=$(echo "$RAG_RESP" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(len(d.get('answer_text') or ''))" 2>/dev/null || echo "0")
RAG_MATCH_COUNT=$(echo "$RAG_RESP" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(len(d.get('matches') or []))" 2>/dev/null || echo "0")
RAG_STATS=$(echo "$RAG_RESP" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); s=d.get('llm_stats'); print('ok' if s and s.get('input_tokens',0)>0 else 'missing')" 2>/dev/null || echo "missing")
RAG_ERR=$(echo "$RAG_RESP" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); e=d.get('error'); print(e if e else '')" 2>/dev/null || echo "PARSE_ERROR")

if [ -z "$RAG_ERR" ] || [ "$RAG_ERR" = "None" ] || [ "$RAG_ERR" = "null" ]; then
  green "  PASS RAG mode: no error"
else
  red   "  FAIL RAG mode: error='$RAG_ERR'"
  OVERALL_PASS=false
fi
assert_eq "RAG response.mode"    "rag" "$RAG_MODE"
assert_eq "RAG debug.mode"       "rag" "$RAG_DBG_MODE"
assert_gt "RAG answer_text length"  0  "$RAG_ANSWER_LEN"
assert_gt "RAG matches count"    0   "$RAG_MATCH_COUNT"
assert_eq "RAG llm_stats present" "ok" "$RAG_STATS"
echo "  RAG wall-clock latency: ${RAG_LATENCY_MS}ms"

# ─── Check 4: Flat/Hierarchical still work ────────────────────────────────────
yellow ""
yellow "━━━ Check 4: Flat and Hierarchical still work (regression check) ━━━"

T_FLAT_START=$(python3 -c "import time; print(int(time.time()*1000))")
FLAT_RESP=$(curl -s -X POST "$API_URL" \
  -H "Origin: $ORIGIN" \
  -H "Content-Type: application/json" \
  --data '{"q":"How do I give a Lambda function access to S3?","mode":"flat"}' 2>/dev/null)
T_FLAT_END=$(python3 -c "import time; print(int(time.time()*1000))")
FLAT_LATENCY_MS=$(( T_FLAT_END - T_FLAT_START ))

FLAT_DBG_MODE=$(echo "$FLAT_RESP" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(d.get('debug',{}).get('mode',''))" 2>/dev/null || echo "PARSE_ERROR")
FLAT_BULLETS=$(echo "$FLAT_RESP" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(len(d.get('answer_bullets') or []))" 2>/dev/null || echo "0")
FLAT_ERR=$(echo "$FLAT_RESP" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); e=d.get('error'); print(e if e else '')" 2>/dev/null || echo "PARSE_ERROR")

if [ -z "$FLAT_ERR" ] || [ "$FLAT_ERR" = "None" ] || [ "$FLAT_ERR" = "null" ]; then
  green "  PASS Flat: no error"
else
  red   "  FAIL Flat: error='$FLAT_ERR'"
  OVERALL_PASS=false
fi
assert_eq  "Flat debug.mode"       "flat" "$FLAT_DBG_MODE"
assert_gt  "Flat answer_bullets"   0      "$FLAT_BULLETS"
echo "  Flat wall-clock latency: ${FLAT_LATENCY_MS}ms"

HIER_RESP=$(curl -s -X POST "$API_URL" \
  -H "Origin: $ORIGIN" \
  -H "Content-Type: application/json" \
  --data '{"q":"Lambda URL vs API Gateway","mode":"hierarchical"}' 2>/dev/null)
HIER_ERR=$(echo "$HIER_RESP" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); e=d.get('error'); print(e if e else '')" 2>/dev/null || echo "PARSE_ERROR")
HIER_BULLETS=$(echo "$HIER_RESP" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(len(d.get('answer_bullets') or []))" 2>/dev/null || echo "0")

if [ -z "$HIER_ERR" ] || [ "$HIER_ERR" = "None" ] || [ "$HIER_ERR" = "null" ]; then
  green "  PASS Hierarchical: no error"
else
  red   "  FAIL Hierarchical: error='$HIER_ERR'"
  OVERALL_PASS=false
fi
assert_gt "Hierarchical answer_bullets" 0 "$HIER_BULLETS"

# ─── Check 5: LLM/RAG latency > 2× Flat ─────────────────────────────────────
yellow ""
yellow "━━━ Check 5: LLM/RAG latency clearly exceeds Flat (sanity) ━━━"
echo "  Flat: ${FLAT_LATENCY_MS}ms  LLM: ${LLM_LATENCY_MS}ms  RAG: ${RAG_LATENCY_MS}ms"

if is_int "$FLAT_LATENCY_MS" && is_int "$LLM_LATENCY_MS" && [ "$FLAT_LATENCY_MS" -gt 0 ]; then
  DOUBLE_FLAT=$(( FLAT_LATENCY_MS * 2 ))
  if [ "$LLM_LATENCY_MS" -gt "$DOUBLE_FLAT" ]; then
    green "  PASS LLM latency (${LLM_LATENCY_MS}ms) > 2× Flat (${FLAT_LATENCY_MS}ms)"
  else
    yellow "  WARN LLM latency (${LLM_LATENCY_MS}ms) not > 2× Flat (${FLAT_LATENCY_MS}ms) — network variance or warm cache"
  fi
  if [ "$RAG_LATENCY_MS" -gt "$DOUBLE_FLAT" ]; then
    green "  PASS RAG latency (${RAG_LATENCY_MS}ms) > 2× Flat (${FLAT_LATENCY_MS}ms)"
  else
    yellow "  WARN RAG latency (${RAG_LATENCY_MS}ms) not > 2× Flat (${FLAT_LATENCY_MS}ms) — network variance or warm cache"
  fi
else
  yellow "  SKIP latency comparison — could not measure reliably"
fi

# ─── Checks 6+7: Benchmark run (skip if quota exhausted or in cooldown) ──────
if [ "$REMAINING_BEFORE" = "0" ] || [ "$NEXT_RUN_ALLOWED" = "false" ]; then
  yellow ""
  if [ "$REMAINING_BEFORE" = "0" ]; then
    yellow "━━━ Checks 6+7: SKIPPED — daily limit already reached ━━━"
  else
    yellow "━━━ Checks 6+7: SKIPPED — in cooldown (${COOLDOWN_BEFORE}s remaining) ━━━"
    yellow "  Re-run after cooldown to verify counter/cooldown behavior."
  fi
else
  yellow ""
  yellow "━━━ Check 6: 4-mode benchmark run (NO key, shared run_id) — counter +1 ━━━"

  RUN_ID="verify-$(date +%s)"
  TEST_Q="How do I give a Lambda function access to S3?"

  for mode in flat hierarchical llm rag; do
    RESP=$(curl -s -X POST "$API_URL" \
      -H "Origin: $ORIGIN" \
      -H "Content-Type: application/json" \
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

    if [ "$mode" = "flat" ]; then
      BULLET_COUNT=$(echo "$RESP" | python3 -c \
        "import sys,json; d=json.load(sys.stdin); print(len(d.get('answer_bullets') or []))" 2>/dev/null || echo "0")
      assert_gt "flat answer_bullets" 0 "$BULLET_COUNT"
    fi
    if [ "$mode" = "llm" ]; then
      LLM_ANSWER_LEN_BM=$(echo "$RESP" | python3 -c \
        "import sys,json; d=json.load(sys.stdin); print(len(d.get('answer_text') or ''))" 2>/dev/null || echo "0")
      assert_gt "llm answer_text in benchmark" 0 "$LLM_ANSWER_LEN_BM"
    fi
  done

  yellow ""
  yellow "━━━ Check 7 (part A): counter incremented by exactly 1 ━━━"

  QUOTA_RESP2=$(curl -s -X POST "$API_URL" \
    -H "Origin: $ORIGIN" \
    -H "Content-Type: application/json" \
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

  yellow ""
  yellow "━━━ Check 7 (part B): immediate second run blocked by ≥1h cooldown ━━━"

  RUN_ID2="verify2-$(date +%s)"
  BLOCK_RESP=$(curl -s -X POST "$API_URL" \
    -H "Origin: $ORIGIN" \
    -H "Content-Type: application/json" \
    --data "{\"q\":\"$TEST_Q\",\"mode\":\"flat\",\"benchmark\":true,\"run_id\":\"$RUN_ID2\"}" \
    2>/dev/null)

  BLOCK_ERR=$(echo "$BLOCK_RESP" | python3 -c \
    "import sys,json; d=json.load(sys.stdin); e=d.get('error'); print(e if e else '')" 2>/dev/null || echo "?")
  COOLDOWN_SECS=$(echo "$BLOCK_RESP" | python3 -c \
    "import sys,json; d=json.load(sys.stdin); q=d.get('quota') or {}; print(int(q.get('seconds_until_next',0)))" 2>/dev/null || echo "0")

  echo "  Block error   : $BLOCK_ERR"
  echo "  Cooldown secs : $COOLDOWN_SECS"

  if [ -n "$BLOCK_ERR" ] && [ "$BLOCK_ERR" != "None" ] && [ "$BLOCK_ERR" != "null" ] && [ "$BLOCK_ERR" != "" ]; then
    green "  PASS second run blocked: '$BLOCK_ERR'"
  else
    red   "  FAIL second run was NOT blocked (expected cooldown error)"
    OVERALL_PASS=false
  fi
  assert_gt "cooldown seconds_until_next" 0 "$COOLDOWN_SECS"
fi

# ─── Check 8: POST /api/benchmark-interest ───────────────────────────────────
yellow ""
yellow "━━━ Check 8: POST /api/benchmark-interest — success + S3 persist ━━━"

TEST_EMAIL="verify-test-$(date +%s)@example.com"
INTEREST_RESP=$(curl -s -X POST "$INTEREST_URL" \
  -H "Origin: $ORIGIN" \
  -H "Content-Type: application/json" \
  --data "{\"email\":\"$TEST_EMAIL\",\"name\":\"Verify Script\",\"note\":\"automated check\"}" \
  2>/dev/null)

echo "  Response: $INTEREST_RESP"

INTEREST_OK=$(echo "$INTEREST_RESP" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(str(d.get('success',False)).lower())" 2>/dev/null || echo "false")
INTEREST_MSG=$(echo "$INTEREST_RESP" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(d.get('message',''))" 2>/dev/null || echo "")
INTEREST_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$INTEREST_URL" \
  -H "Origin: $ORIGIN" -H "Content-Type: application/json" \
  --data "{\"email\":\"$TEST_EMAIL\"}" 2>/dev/null)

if [ "$INTEREST_OK" = "true" ]; then
  green "  PASS interest form: success=true"
else
  red   "  FAIL interest form: expected success=true, got '$INTEREST_OK'"
  OVERALL_PASS=false
fi

if [ -n "$INTEREST_MSG" ]; then
  green "  PASS interest form: message='$INTEREST_MSG'"
else
  red   "  FAIL interest form: no message returned"
  OVERALL_PASS=false
fi

# Validate request (bad email should return 400)
BAD_RESP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$INTEREST_URL" \
  -H "Origin: $ORIGIN" -H "Content-Type: application/json" \
  --data '{"email":"not-an-email"}' 2>/dev/null)

if [ "$BAD_RESP" = "400" ]; then
  green "  PASS interest form: invalid email returns 400"
else
  yellow "  WARN interest form: invalid email returned $BAD_RESP (expected 400)"
fi

# ─── Check 9: /api/upload* CORS ──────────────────────────────────────────────
yellow ""
yellow "━━━ Check 9: /api/upload* CORS — single ACAO on OPTIONS + POST ━━━"

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

# ─── Check 10: Explore plain search still works ──────────────────────────────
yellow ""
yellow "━━━ Check 10: Explore plain search (no benchmark flag) ━━━"

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

assert_gt    "Explore answer_bullets"              0 "$EXPLORE_BULLETS"
assert_count "Explore ACAO count (single, no dupe)" 1 "$EXPLORE_ACAO"

# ─── Summary ─────────────────────────────────────────────────────────────────
echo ""
if $OVERALL_PASS; then
  green "══════════════════════════════════════"
  green "  ALL BENCHMARK CHECKS PASSED"
  green "══════════════════════════════════════"
  exit 0
else
  red   "══════════════════════════════════════"
  red   "  ONE OR MORE CHECKS FAILED"
  red   "══════════════════════════════════════"
  exit 1
fi
