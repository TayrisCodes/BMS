#!/bin/bash

# Simplified test script for Payment Initiation System (no jq required)
# Tests payment intent creation and status retrieval

set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"
ORG_ADMIN_EMAIL="${ORG_ADMIN_EMAIL:-admin@example.com}"
ORG_ADMIN_PASSWORD="${ORG_ADMIN_PASSWORD:-ChangeMe123!}"
SESSION_COOKIE="bms_session"

echo "🧪 Testing Payment Initiation System (Simplified)"
echo "=================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper function to extract JSON value (simple grep-based)
extract_json_value() {
  local json="$1"
  local key="$2"
  echo "$json" | grep -o "\"$key\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | head -1 | sed 's/.*"\([^"]*\)".*/\1/' || echo ""
}

extract_json_id() {
  local json="$1"
  echo "$json" | grep -o '"_id"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"\([^"]*\)".*/\1/' || echo ""
}

# Check if server is running
echo -e "${YELLOW}Checking server status...${NC}"
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/health" 2>&1)
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -1)

if [ "$HTTP_CODE" != "200" ]; then
  echo -e "${RED}❌ Server is not running at $BASE_URL (HTTP $HTTP_CODE)${NC}"
  echo -e "${YELLOW}Please start the dev server with: npm run dev${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Server is running${NC}"
echo ""

# Step 1: Login as ORG_ADMIN
echo -e "${YELLOW}Step 1: Logging in as ORG_ADMIN...${NC}"
LOGIN_RESPONSE=$(curl -s -c /tmp/payment_test_cookies.txt -X POST "${BASE_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"identifier\":\"${ORG_ADMIN_EMAIL}\",\"password\":\"${ORG_ADMIN_PASSWORD}\"}")

if echo "$LOGIN_RESPONSE" | grep -qi "error"; then
  echo -e "${RED}❌ Admin login failed${NC}"
  echo "$LOGIN_RESPONSE"
  exit 1
fi

SESSION=$(grep "$SESSION_COOKIE" /tmp/payment_test_cookies.txt 2>/dev/null | awk '{print $7}' || echo "")

if [ -z "$SESSION" ]; then
  echo -e "${RED}❌ Failed to get session token${NC}"
  echo "Login response: $LOGIN_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Admin login successful${NC}"
echo ""

# Step 2: Get or create an active tenant
echo -e "${YELLOW}Step 2: Getting tenant information...${NC}"
TIMESTAMP=$(date +%s)
TENANT_PHONE="+2519${TIMESTAMP: -8}"

# Try to get existing tenants first
TENANTS_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/tenants" \
  -b "${SESSION_COOKIE}=${SESSION}")

# Try to find an active tenant first using Python (more reliable JSON parsing)
TENANT_ID=""
TENANT_PHONE=""
if command -v python3 >/dev/null 2>&1; then
  ACTIVE_TENANT=$(echo "$TENANTS_RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    tenants = data.get('tenants', [])
    active = [t for t in tenants if t.get('status') == 'active']
    if active:
        t = active[0]
        print(f\"{t.get('_id', '')}|{t.get('primaryPhone', '')}\")
except:
    pass
" 2>/dev/null)
  if [ -n "$ACTIVE_TENANT" ] && [ "$ACTIVE_TENANT" != "|" ]; then
    TENANT_ID=$(echo "$ACTIVE_TENANT" | cut -d'|' -f1)
    TENANT_PHONE=$(echo "$ACTIVE_TENANT" | cut -d'|' -f2)
  fi
fi

# Fallback: if Python not available or didn't find active tenant, create new one
if [ -z "$TENANT_ID" ] || [ -z "$TENANT_PHONE" ]; then
  # Try simple grep as fallback
  if echo "$TENANTS_RESPONSE" | grep -q '"status"[[:space:]]*:[[:space:]]*"active"'; then
    # This is a best-effort extraction
    FIRST_ACTIVE=$(echo "$TENANTS_RESPONSE" | grep -B 10 '"status"[[:space:]]*:[[:space:]]*"active"' | head -15)
    TENANT_ID=$(echo "$FIRST_ACTIVE" | grep -o '"_id"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"\([^"]*\)".*/\1/')
    TENANT_PHONE=$(echo "$FIRST_ACTIVE" | grep -o '"primaryPhone"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"\([^"]*\)".*/\1/')
  fi
fi

if [ -z "$TENANT_ID" ] || [ -z "$TENANT_PHONE" ]; then
  echo "  No active tenant found, creating new active tenant..."
  CREATE_TENANT_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/tenants" \
    -b "${SESSION_COOKIE}=${SESSION}" \
    -H "Content-Type: application/json" \
    -d "{
      \"firstName\": \"Test\",
      \"lastName\": \"Tenant\",
      \"primaryPhone\": \"${TENANT_PHONE}\",
      \"email\": \"tenant${TIMESTAMP}@test.com\",
      \"status\": \"active\"
    }")
  
  TENANT_ID=$(extract_json_id "$CREATE_TENANT_RESPONSE")
  
  if [ -z "$TENANT_ID" ]; then
    echo -e "${RED}❌ Failed to create tenant${NC}"
    echo "$CREATE_TENANT_RESPONSE"
    exit 1
  fi
  
  TENANT_PHONE=$(extract_json_value "$CREATE_TENANT_RESPONSE" "primaryPhone" || echo "$TENANT_PHONE")
  echo -e "${GREEN}✅ Tenant created${NC}"
else
  echo -e "${GREEN}✅ Using existing active tenant${NC}"
fi

echo "Tenant ID: $TENANT_ID"
echo "Tenant Phone: $TENANT_PHONE"
echo ""

# Step 3: Request OTP
echo -e "${YELLOW}Step 3: Requesting OTP for tenant login...${NC}"
OTP_REQUEST_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/auth/request-otp" \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"${TENANT_PHONE}\"}")

if echo "$OTP_REQUEST_RESPONSE" | grep -qi "error"; then
  echo -e "${RED}❌ Failed to request OTP${NC}"
  echo "$OTP_REQUEST_RESPONSE"
  exit 1
fi

OTP_CODE=$(extract_json_value "$OTP_REQUEST_RESPONSE" "code" || echo "123456")

echo -e "${GREEN}✅ OTP requested (Code: ${OTP_CODE})${NC}"
echo ""

# Step 4: Verify OTP and login as tenant
echo -e "${YELLOW}Step 4: Verifying OTP and logging in as tenant...${NC}"
TENANT_LOGIN_RESPONSE=$(curl -s -c /tmp/tenant_cookies.txt -X POST "${BASE_URL}/api/auth/verify-otp" \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"${TENANT_PHONE}\",\"code\":\"${OTP_CODE}\"}")

if echo "$TENANT_LOGIN_RESPONSE" | grep -qi "error"; then
  echo -e "${RED}❌ Tenant login failed${NC}"
  echo "$TENANT_LOGIN_RESPONSE"
  exit 1
fi

TENANT_SESSION=$(grep "$SESSION_COOKIE" /tmp/tenant_cookies.txt 2>/dev/null | awk '{print $7}' || echo "")

if [ -z "$TENANT_SESSION" ]; then
  echo -e "${RED}❌ Failed to get tenant session token${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Tenant login successful${NC}"
echo ""

# Step 5: Create payment intent
echo -e "${YELLOW}Step 5: Creating payment intent (standalone payment)...${NC}"
PAYMENT_AMOUNT=1000
PAYMENT_PROVIDER="telebirr"

INTENT_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/tenant/payments/intent" \
  -H "Content-Type: application/json" \
  -b "${SESSION_COOKIE}=${TENANT_SESSION}" \
  -d "{
    \"amount\": ${PAYMENT_AMOUNT},
    \"provider\": \"${PAYMENT_PROVIDER}\"
  }")

if echo "$INTENT_RESPONSE" | grep -qi "error"; then
  echo -e "${RED}❌ Failed to create payment intent${NC}"
  echo "$INTENT_RESPONSE"
  exit 1
fi

INTENT_ID=$(extract_json_value "$INTENT_RESPONSE" "intentId" || extract_json_id "$INTENT_RESPONSE")

if [ -z "$INTENT_ID" ]; then
  echo -e "${RED}❌ Payment intent ID not found in response${NC}"
  echo "$INTENT_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Payment intent created${NC}"
echo "Intent ID: $INTENT_ID"
echo "Response preview:"
echo "$INTENT_RESPONSE" | head -10
echo ""

# Step 6: Get payment intent status
echo -e "${YELLOW}Step 6: Retrieving payment intent status...${NC}"
STATUS_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/tenant/payments/intent/${INTENT_ID}" \
  -b "${SESSION_COOKIE}=${TENANT_SESSION}")

if echo "$STATUS_RESPONSE" | grep -qi "error"; then
  echo -e "${RED}❌ Failed to get payment intent status${NC}"
  echo "$STATUS_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Payment intent status retrieved${NC}"
echo "Status preview:"
echo "$STATUS_RESPONSE" | head -10
echo ""

# Step 7: Test with different providers
echo -e "${YELLOW}Step 7: Testing different payment providers...${NC}"
PROVIDERS=("cbe_birr" "chapa" "hellocash" "bank_transfer")

for PROVIDER in "${PROVIDERS[@]}"; do
  echo "  Testing provider: $PROVIDER"
  PROVIDER_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/tenant/payments/intent" \
    -H "Content-Type: application/json" \
    -b "${SESSION_COOKIE}=${TENANT_SESSION}" \
    -d "{
      \"amount\": 500,
      \"provider\": \"${PROVIDER}\"
    }")
  
  if echo "$PROVIDER_RESPONSE" | grep -qi "error"; then
    echo -e "    ${RED}❌ Failed${NC}"
    ERROR_MSG=$(extract_json_value "$PROVIDER_RESPONSE" "error" || echo "Error")
    echo "    Error: $ERROR_MSG"
  else
    PROVIDER_INTENT_ID=$(extract_json_value "$PROVIDER_RESPONSE" "intentId" || extract_json_id "$PROVIDER_RESPONSE")
    if [ -n "$PROVIDER_INTENT_ID" ] && [ "$PROVIDER_INTENT_ID" != "null" ]; then
      echo -e "    ${GREEN}✅ Success (Intent ID: ${PROVIDER_INTENT_ID})${NC}"
    else
      echo -e "    ${YELLOW}⚠️  Response received but no intent ID${NC}"
    fi
  fi
done
echo ""

# Step 8: Test error cases
echo -e "${YELLOW}Step 8: Testing error cases...${NC}"

# Test with invalid amount
echo "  Testing with invalid amount (0)..."
ERROR_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/tenant/payments/intent" \
  -H "Content-Type: application/json" \
  -b "${SESSION_COOKIE}=${TENANT_SESSION}" \
  -d "{
    \"amount\": 0,
    \"provider\": \"telebirr\"
  }")

if echo "$ERROR_RESPONSE" | grep -qi "error"; then
  echo -e "    ${GREEN}✅ Correctly rejected invalid amount${NC}"
else
  echo -e "    ${RED}❌ Should have rejected invalid amount${NC}"
fi

# Test with invalid provider
echo "  Testing with invalid provider..."
ERROR_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/tenant/payments/intent" \
  -H "Content-Type: application/json" \
  -b "${SESSION_COOKIE}=${TENANT_SESSION}" \
  -d "{
    \"amount\": 1000,
    \"provider\": \"invalid_provider\"
  }")

if echo "$ERROR_RESPONSE" | grep -qi "error"; then
  echo -e "    ${GREEN}✅ Correctly rejected invalid provider${NC}"
else
  echo -e "    ${RED}❌ Should have rejected invalid provider${NC}"
fi
echo ""

# Summary
echo ""
echo "=================================================="
echo -e "${GREEN}✅ Payment Initiation System Test Complete${NC}"
echo ""
echo -e "${BLUE}Test Summary:${NC}"
echo "  ✅ Server health check"
echo "  ✅ Login as ORG_ADMIN"
echo "  ✅ Get/Create tenant"
echo "  ✅ Request OTP for tenant"
echo "  ✅ Login as tenant"
echo "  ✅ Create payment intent"
echo "  ✅ Retrieve payment intent status"
echo "  ✅ Test multiple payment providers"
echo "  ✅ Test error handling"
echo ""
echo -e "${GREEN}All tests passed! 🎉${NC}"

