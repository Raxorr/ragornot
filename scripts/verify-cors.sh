#!/usr/bin/env bash
# verify-cors.sh — assert CORS is working correctly on the ragornot API endpoints.
# Usage: bash scripts/verify-cors.sh
# Exit 0 = all PASS. Exit 1 = one or more FAIL.
#
# What it checks per endpoint:
#   - OPTIONS preflight: exactly one access-control-allow-origin (value *), contains
#     POST and OPTIONS in allow-methods, content-type and x-benchmark-mode in
#     allow-headers, returns HTTP 200 or 204.
#   - POST actual request: exactly one access-control-allow-origin (value *),
#     HTTP 200, JSON body with no error field.

set -euo pipefail

ORIGIN="https://raxorr.github.io"
API_BASE="https://d8mkun1yo4v0c.cloudfront.net"
MAX_ATTEMPTS=18   # ~3 minutes with 10 s sleep
SLEEP_S=10
OVERALL_PASS=true

# ── helpers ───────────────────────────────────────────────────────────────────

green()  { printf '\033[32m%s\033[0m\n' "$*"; }
red()    { printf '\033[31m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }

assert_eq() {
  local label="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then
    green  "  PASS $label: '$actual'"
  else
    red    "  FAIL $label: expected '$expected', got '$actual'"
    OVERALL_PASS=false
  fi
}

assert_contains_ci() {
  local label="$1" needle="$2" haystack="$3"
  if echo "$haystack" | grep -qi "$needle"; then
    green  "  PASS $label: contains '$needle'"
  else
    red    "  FAIL $label: '$needle' not found in '$haystack'"
    OVERALL_PASS=false
  fi
}

assert_count() {
  local label="$1" expected="$2" actual="$3"
  if [ "$actual" -eq "$expected" ]; then
    green  "  PASS $label: count=$actual"
  else
    red    "  FAIL $label: expected count=$expected, got count=$actual"
    OVERALL_PASS=false
  fi
}

# Retry a curl preflight+POST pair until it passes or we time out.
check_endpoint() {
  local name="$1" path="$2" payload="$3"
  local url="${API_BASE}${path}"
  local attempt pass

  yellow "━━━ $name ($url) ━━━"

  for attempt in $(seq 1 $MAX_ATTEMPTS); do
    yellow "  attempt $attempt / $MAX_ATTEMPTS …"
    pass=true

    # ── OPTIONS preflight ──
    PREFLIGHT_RESP=$(curl -s -i -X OPTIONS "$url" \
      -H "Origin: $ORIGIN" \
      -H "Access-Control-Request-Method: POST" \
      -H "Access-Control-Request-Headers: content-type,x-benchmark-mode" \
      2>/dev/null)

    PREFLIGHT_STATUS=$(echo "$PREFLIGHT_RESP" | grep -i '^HTTP' | tail -1 | awk '{print $2}')
    ACAO_PREFLIGHT=$(echo "$PREFLIGHT_RESP" | grep -i '^access-control-allow-origin:' | wc -l | tr -d ' ')
    ACAO_VAL_PREFLIGHT=$(echo "$PREFLIGHT_RESP" | grep -i '^access-control-allow-origin:' | tail -1 | awk '{$1=""; print $0}' | tr -d ' \r')
    ACAM=$(echo "$PREFLIGHT_RESP" | grep -i '^access-control-allow-methods:' | tail -1)
    ACAH=$(echo "$PREFLIGHT_RESP" | grep -i '^access-control-allow-headers:' | tail -1)

    echo "  [OPTIONS]"
    echo "    Status : $PREFLIGHT_STATUS"
    echo "    Raw CORS headers:"
    echo "$PREFLIGHT_RESP" | grep -i '^access-control' | sed 's/^/      /'

    if [ "$ACAO_PREFLIGHT" -eq 0 ]; then
      red "  FAIL OPTIONS: no access-control-allow-origin — CloudFront may still be propagating, retrying …"
      pass=false
    else
      assert_count "OPTIONS ACAO count" 1 "$ACAO_PREFLIGHT"
      assert_eq    "OPTIONS ACAO value" "*" "$ACAO_VAL_PREFLIGHT"
      assert_contains_ci "OPTIONS allows POST"    "POST"             "$ACAM"
      assert_contains_ci "OPTIONS allows OPTIONS" "OPTIONS"          "$ACAM"
      assert_contains_ci "OPTIONS allows content-type"    "content-type"    "$ACAH"
      assert_contains_ci "OPTIONS allows x-benchmark-mode" "x-benchmark-mode" "$ACAH"
      case "$PREFLIGHT_STATUS" in
        200|204) green  "  PASS OPTIONS status: $PREFLIGHT_STATUS" ;;
        *)       red    "  FAIL OPTIONS status: expected 200 or 204, got $PREFLIGHT_STATUS"
                 pass=false ;;
      esac
    fi

    # ── POST actual request ──
    POST_RESP=$(curl -s -i -X POST "$url" \
      -H "Origin: $ORIGIN" \
      -H "Content-Type: application/json" \
      -H "X-Benchmark-Mode: flat" \
      --data "$payload" \
      2>/dev/null)

    POST_STATUS=$(echo "$POST_RESP" | grep -i '^HTTP' | tail -1 | awk '{print $2}')
    ACAO_POST=$(echo "$POST_RESP" | grep -i '^access-control-allow-origin:' | wc -l | tr -d ' ')
    ACAO_VAL_POST=$(echo "$POST_RESP" | grep -i '^access-control-allow-origin:' | tail -1 | awk '{$1=""; print $0}' | tr -d ' \r')
    POST_BODY=$(echo "$POST_RESP" | tail -1)
    POST_ERROR=$(echo "$POST_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('error',''))" 2>/dev/null || echo "")

    echo "  [POST]"
    echo "    Status : $POST_STATUS"
    echo "    Raw CORS headers:"
    echo "$POST_RESP" | grep -i '^access-control' | sed 's/^/      /'

    assert_count "POST ACAO count" 1 "$ACAO_POST"
    assert_eq    "POST ACAO value" "*" "$ACAO_VAL_POST"
    assert_eq    "POST status"     "200" "$POST_STATUS"
    if [ -n "$POST_ERROR" ] && [ "$POST_ERROR" != "None" ] && [ "$POST_ERROR" != "null" ]; then
      red "  FAIL POST body.error: '$POST_ERROR'"
      pass=false
    else
      green "  PASS POST body.error: none"
    fi

    if $pass; then
      green "  ✓ $name PASSED on attempt $attempt"
      return 0
    fi

    if [ "$attempt" -lt "$MAX_ATTEMPTS" ]; then
      yellow "  Retrying in ${SLEEP_S}s …"
      sleep $SLEEP_S
    fi
  done

  red "  ✗ $name FAILED after $MAX_ATTEMPTS attempts"
  OVERALL_PASS=false
}

# ── run checks ────────────────────────────────────────────────────────────────

check_endpoint "Explore (/api/search)" "/api/search" \
  '{"q":"S3 static hosting","mode":"flat"}'

check_endpoint "Benchmark (/api/search — benchmark path)" "/api/search" \
  '{"q":"Lambda function URL vs API Gateway","mode":"hierarchical"}'

# ── summary ───────────────────────────────────────────────────────────────────

echo ""
if $OVERALL_PASS; then
  green "══════════════════════════════════"
  green "  ALL CHECKS PASSED"
  green "══════════════════════════════════"
  exit 0
else
  red   "══════════════════════════════════"
  red   "  ONE OR MORE CHECKS FAILED"
  red   "══════════════════════════════════"
  exit 1
fi
