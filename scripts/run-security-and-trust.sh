#!/usr/bin/env bash
#
# MetaMesh-UGA — Security Scan & Trust Recalculation Runner
# Esegue security scan e ricalcolo trust per un tool di esempio.
#

set -e

BASE_URL="${BASE_URL:-https://api.metamesh-uga.dev}"
ADMIN_KEY="${ADMIN_KEY:-}"
TOOL_NAME="${TOOL_NAME:-example.echo}"

if [ -z "$ADMIN_KEY" ]; then
  echo "❌ ADMIN_KEY non impostato."
  echo "Esegui: export ADMIN_KEY=il_tuo_admin_key"
  exit 1
fi

echo "=== Running Security Scan & Trust Recalculation ==="
echo "Base URL: $BASE_URL"
echo "Tool: $TOOL_NAME"
echo ""

# 1. Security Scan
echo "1. Triggering security scan..."
response=$(curl -s -X POST "$BASE_URL/v1/admin/security/scan/$TOOL_NAME" \
  -H "X-Admin-Key: $ADMIN_KEY")
echo "Response: $response"
echo ""

# 2. Wait briefly for async processing
sleep 2

# 3. Retrieve security score
echo "2. Retrieving security score..."
response=$(curl -s "$BASE_URL/v1/security/$TOOL_NAME")
echo "Response: $response"
score=$(echo "$response" | jq -r '.security_score // 0')
echo "Security score: $score"
echo ""

# 4. Recalculate trust
echo "3. Triggering trust recalculation..."
response=$(curl -s -X POST "$BASE_URL/v1/admin/trust/recalculate/$TOOL_NAME" \
  -H "X-Admin-Key: $ADMIN_KEY")
echo "Response: $response"
echo ""

# 5. Wait briefly
sleep 2

# 6. Retrieve trust score
echo "4. Retrieving trust score..."
response=$(curl -s "$BASE_URL/v1/tools/$TOOL_NAME/trust")
echo "Response: $response"
trust=$(echo "$response" | jq -r '.trust_score // 0')
echo "Trust score: $trust"
echo ""

echo "=== Done ==="
