#!/usr/bin/env bash
#
# MetaMesh-UGA — Endpoint Verification Script
# Verifica che i principali endpoint rispondano correttamente.
#

set -e

BASE_URL="${BASE_URL:-https://api.metamesh-uga.dev}"
ADMIN_KEY="${ADMIN_KEY:-}"
REPORT_FILE="${REPORT_FILE:-./verification-report.json}"

# Inizializza report
RESULTS=$(mktemp)
echo '[]' > "$RESULTS"

pass=0
fail=0

log_check() {
  local name="$1"
  local status="$2"
  local message="$3"
  local jq_filter='. + [{"name": "'"$name"'", "status": "'"$status"'", "message": "'"$message"'"}]'
  RESULTS=$(echo "$RESULTS" | jq "$jq_filter")
  if [ "$status" = "PASS" ]; then
    pass=$((pass + 1))
    echo "✅ $name"
  else
    fail=$((fail + 1))
    echo "❌ $name: $message"
  fi
}

# 1. Health Check
echo "Checking /health..."
if response=$(curl -s "$BASE_URL/health"); then
  if echo "$response" | jq -e '.status' >/dev/null 2>&1; then
    log_check "Health Check" "PASS" "Response: $response"
  else
    log_check "Health Check" "FAIL" "Invalid response: $response"
  fi
else
  log_check "Health Check" "FAIL" "No response"
fi

# 2. Tools List
echo "Checking /v1/tools..."
if response=$(curl -s "$BASE_URL/v1/tools"); then
  total=$(echo "$response" | jq -r '.total // 0')
  if [ "$total" -gt 0 ] 2>/dev/null; then
    log_check "Tools List" "PASS" "Found $total tools"
  else
    log_check "Tools List" "FAIL" "No tools found: $response"
  fi
else
  log_check "Tools List" "FAIL" "No response"
fi

# 3. Tool Call (requires example.echo or fails gracefully)
echo "Checking /v1/call..."
if response=$(curl -s -X POST "$BASE_URL/v1/call" \
  -H "Content-Type: application/json" \
  -d '{"tool":"example.echo","params":{"message":"test"}}' 2>/dev/null); then
  if echo "$response" | jq -e '.error' >/dev/null 2>&1; then
    log_check "Tool Call" "FAIL" "Error: $response"
  else
    log_check "Tool Call" "PASS" "Response: $(echo "$response" | head -c 200)"
  fi
else
  log_check "Tool Call" "FAIL" "No response"
fi

# 4. Search
echo "Checking /v1/search..."
if response=$(curl -s "$BASE_URL/v1/search?q=email"); then
  if echo "$response" | jq -e '.results' >/dev/null 2>&1; then
    count=$(echo "$response" | jq '.results | length')
    log_check "Search" "PASS" "Found $count results"
  else
    log_check "Search" "FAIL" "Invalid response: $response"
  fi
else
  log_check "Search" "FAIL" "No response"
fi

# 5. Trust Score
echo "Checking /v1/tools/example.echo/trust..."
if response=$(curl -s "$BASE_URL/v1/tools/example.echo/trust"); then
  if echo "$response" | jq -e '.trust_score' >/dev/null 2>&1; then
    log_check "Trust Score" "PASS" "Score: $(echo "$response" | jq -r '.trust_score')"
  else
    log_check "Trust Score" "FAIL" "Invalid response: $response"
  fi
else
  log_check "Trust Score" "FAIL" "No response"
fi

# 6. Recommend
echo "Checking /v1/recommend..."
if response=$(curl -s "$BASE_URL/v1/recommend?q=send+email"); then
  if echo "$response" | jq -e '.recommendations' >/dev/null 2>&1; then
    count=$(echo "$response" | jq '.recommendations | length')
    log_check "Recommend" "PASS" "Found $count recommendations"
  else
    log_check "Recommend" "FAIL" "Invalid response: $response"
  fi
else
  log_check "Recommend" "FAIL" "No response"
fi

# 7. Prometheus Metrics
echo "Checking /v1/metrics/prometheus..."
if response=$(curl -s "$BASE_URL/v1/metrics/prometheus"); then
  if [ -n "$response" ]; then
    log_check "Prometheus Metrics" "PASS" "Metrics returned ($(echo "$response" | wc -l) lines)"
  else
    log_check "Prometheus Metrics" "FAIL" "Empty response"
  fi
else
  log_check "Prometheus Metrics" "FAIL" "No response"
fi

# 8. Admin endpoints (if ADMIN_KEY is set)
if [ -n "$ADMIN_KEY" ]; then
  echo "Checking admin endpoints..."
  
  # Security scan
  if response=$(curl -s -X POST "$BASE_URL/v1/admin/security/scan/example.echo" \
    -H "X-Admin-Key: $ADMIN_KEY" 2>/dev/null); then
    log_check "Security Scan" "PASS" "Triggered: $(echo "$response" | head -c 200)"
  else
    log_check "Security Scan" "FAIL" "No response"
  fi
  
  # Trust recalc
  if response=$(curl -s -X POST "$BASE_URL/v1/admin/trust/recalculate/example.echo" \
    -H "X-Admin-Key: $ADMIN_KEY" 2>/dev/null); then
    log_check "Trust Recalc" "PASS" "Triggered: $(echo "$response" | head -c 200)"
  else
    log_check "Trust Recalc" "FAIL" "No response"
  fi
  
  # Registry sync
  if response=$(curl -s -X POST "$BASE_URL/v1/admin/registry/sync" \
    -H "X-Admin-Key: $ADMIN_KEY" 2>/dev/null); then
    log_check "Registry Sync" "PASS" "Triggered: $(echo "$response" | head -c 200)"
  else
    log_check "Registry Sync" "FAIL" "No response"
  fi
  
  # Self-heal
  if response=$(curl -s -X POST "$BASE_URL/v1/admin/heal" \
    -H "X-Admin-Key: $ADMIN_KEY" 2>/dev/null); then
    log_check "Self-Healing" "PASS" "Triggered: $(echo "$response" | head -c 200)"
  else
    log_check "Self-Healing" "FAIL" "No response"
  fi
fi

# 9. Dashboard
echo "Checking dashboard..."
if response=$(curl -s -I "$BASE_URL/v1/dashboard/health"); then
  log_check "Dashboard API" "PASS" "Accessible"
else
  log_check "Dashboard API" "FAIL" "No response"
fi

# Genera report
echo "Generating report..."
REPORT=$(jq -n \
  --arg base_url "$BASE_URL" \
  --arg timestamp "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
  --argjson results "$RESULTS" \
  --argjson pass "$pass" \
  --argjson fail "$fail" \
  '{
    base_url: $base_url,
    timestamp: $timestamp,
    pass: $pass,
    fail: $fail,
    status: (if $fail == 0 then "PASS" else "FAIL" end),
    checks: $results
  }')

echo "$REPORT" > "$REPORT_FILE"
echo ""
echo "Report saved to $REPORT_FILE"
echo "Summary: $pass passed, $fail failed"

if [ "$fail" -eq 0 ]; then
  exit 0
else
  exit 1
fi
