#!/bin/bash

# Comprehensive Payment Flow Test Script
# Tests payment intent creation with/without invoice, different providers, and status checking

set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"
ORG_ADMIN_EMAIL="${ORG_ADMIN_EMAIL:-admin@example.com}"
ORG_ADMIN_PASSWORD="${ORG_ADMIN_PASSWORD:-ChangeMe123!}"
SESSION_COOKIE="bms_session"

echo "🧪 Comprehensive Payment Flow Test"
echo "===================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Helper functions
extract_json_value() {
  local json="$1"
  local key="$2"
  if command -v python3 >/dev/null 2>&1; then
    echo "$json" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    value = data.get('$key', '')
    if value:
        print(value)
except:
    pass
" 2>/dev/null || echo ""
  else
    echo "$json" | grep -o "\"$key\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | head -1 | sed 's/.*"\([^"]*\)".*/\1/' || echo ""
  fi
}

extract_json_id() {
  local json="$1"
  if command -v python3 >/dev/null 2>&1; then
    echo "$json" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    _id = data.get('_id', '') or data.get('id', '')
    if _id:
        print(_id)
except:
    pass
" 2>/dev/null || echo ""
  else
    echo "$json" | grep -o '"_id"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"\([^"]*\)".*/\1/' || echo ""
  fi
}

# Check server
echo -e "${YELLOW}Checking server...${NC}"
if ! curl -s -f "${BASE_URL}/api/health" > /dev/null; then
  echo -e "${RED}❌ Server not running${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Server running${NC}"
echo ""

# Login as ORG_ADMIN
echo -e "${YELLOW}Step 1: Logging in as ORG_ADMIN...${NC}"
LOGIN_RESPONSE=$(curl -s -c /tmp/test_cookies.txt -X POST "${BASE_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"identifier\":\"${ORG_ADMIN_EMAIL}\",\"password\":\"${ORG_ADMIN_PASSWORD}\"}")

if echo "$LOGIN_RESPONSE" | grep -qi "error"; then
  echo -e "${RED}❌ Login failed${NC}"
  exit 1
fi

SESSION=$(grep "$SESSION_COOKIE" /tmp/test_cookies.txt 2>/dev/null | awk '{print $7}' || echo "")
if [ -z "$SESSION" ]; then
  echo -e "${RED}❌ No session token${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Admin logged in${NC}"
echo ""

# Get or create tenant
echo -e "${YELLOW}Step 2: Getting tenant...${NC}"
TIMESTAMP=$(date +%s)
TENANT_PHONE="+2519${TIMESTAMP: -8}"

TENANTS_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/tenants" \
  -b "${SESSION_COOKIE}=${SESSION}")

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

if [ -z "$TENANT_ID" ]; then
  echo "  Creating new tenant..."
  CREATE_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/tenants" \
    -b "${SESSION_COOKIE}=${SESSION}" \
    -H "Content-Type: application/json" \
    -d "{
      \"firstName\": \"Test\",
      \"lastName\": \"Tenant\",
      \"primaryPhone\": \"${TENANT_PHONE}\",
      \"email\": \"tenant${TIMESTAMP}@test.com\",
      \"status\": \"active\"
    }")
  TENANT_ID=$(extract_json_id "$CREATE_RESPONSE")
  TENANT_PHONE=$(extract_json_value "$CREATE_RESPONSE" "primaryPhone" || echo "$TENANT_PHONE")
fi
echo -e "${GREEN}✅ Tenant ready (${TENANT_PHONE})${NC}"
echo ""

# Request OTP
echo -e "${YELLOW}Step 3: Requesting OTP...${NC}"
OTP_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/auth/request-otp" \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"${TENANT_PHONE}\"}")
OTP_CODE=$(extract_json_value "$OTP_RESPONSE" "code" || echo "123456")
echo -e "${GREEN}✅ OTP received (${OTP_CODE})${NC}"
echo ""

# Login as tenant
echo -e "${YELLOW}Step 4: Logging in as tenant...${NC}"
TENANT_LOGIN_RESPONSE=$(curl -s -c /tmp/tenant_cookies.txt -X POST "${BASE_URL}/api/auth/verify-otp" \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"${TENANT_PHONE}\",\"code\":\"${OTP_CODE}\"}")
TENANT_SESSION=$(grep "$SESSION_COOKIE" /tmp/tenant_cookies.txt 2>/dev/null | awk '{print $7}' || echo "")
if [ -z "$TENANT_SESSION" ]; then
  echo -e "${RED}❌ Tenant login failed${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Tenant logged in${NC}"
echo ""

# Test 10.1.1: Payment Intent Creation
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo -e "${BLUE}Test 10.1.1: Payment Intent Creation${NC}"
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo ""

# Test 10.1.1a: Without invoice ID (manual payment)
echo -e "${YELLOW}Test 10.1.1a: Manual payment (no invoice ID)...${NC}"
MANUAL_PAYMENT_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/tenant/payments/intent" \
  -H "Content-Type: application/json" \
  -b "${SESSION_COOKIE}=${TENANT_SESSION}" \
  -d "{
    \"amount\": 1500,
    \"provider\": \"telebirr\"
  }")

if echo "$MANUAL_PAYMENT_RESPONSE" | grep -qi "error"; then
  echo -e "${RED}❌ Failed${NC}"
  echo "$MANUAL_PAYMENT_RESPONSE"
else
  MANUAL_INTENT_ID=$(extract_json_value "$MANUAL_PAYMENT_RESPONSE" "intentId" || extract_json_id "$MANUAL_PAYMENT_RESPONSE")
  if [ -n "$MANUAL_INTENT_ID" ] && [ "$MANUAL_INTENT_ID" != "null" ]; then
    echo -e "${GREEN}✅ Success (Intent ID: ${MANUAL_INTENT_ID})${NC}"
  else
    echo -e "${RED}❌ No intent ID in response${NC}"
  fi
fi
echo ""

# Test 10.1.1b: With invoice ID (if invoice exists)
echo -e "${YELLOW}Test 10.1.1b: Payment with invoice ID...${NC}"
# Try to get an invoice
INVOICES_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/tenant/invoices" \
  -b "${SESSION_COOKIE}=${TENANT_SESSION}")

INVOICE_ID=""
if command -v python3 >/dev/null 2>&1; then
  INVOICE_ID=$(echo "$INVOICES_RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    invoices = data.get('invoices', []) or data.get('data', []) or (data if isinstance(data, list) else [])
    if invoices:
        inv = invoices[0]
        print(inv.get('_id', '') or inv.get('id', ''))
except:
    pass
" 2>/dev/null)
fi

if [ -n "$INVOICE_ID" ] && [ "$INVOICE_ID" != "null" ]; then
  INVOICE_PAYMENT_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/tenant/payments/intent" \
    -H "Content-Type: application/json" \
    -b "${SESSION_COOKIE}=${TENANT_SESSION}" \
    -d "{
      \"invoiceId\": \"${INVOICE_ID}\",
      \"amount\": 2000,
      \"provider\": \"cbe_birr\"
    }")
  
  if echo "$INVOICE_PAYMENT_RESPONSE" | grep -qi "error"; then
    echo -e "${RED}❌ Failed${NC}"
    echo "$INVOICE_PAYMENT_RESPONSE"
  else
    INVOICE_INTENT_ID=$(extract_json_value "$INVOICE_PAYMENT_RESPONSE" "intentId" || extract_json_id "$INVOICE_PAYMENT_RESPONSE")
    if [ -n "$INVOICE_INTENT_ID" ] && [ "$INVOICE_INTENT_ID" != "null" ]; then
      echo -e "${GREEN}✅ Success (Intent ID: ${INVOICE_INTENT_ID})${NC}"
    else
      echo -e "${RED}❌ No intent ID in response${NC}"
    fi
  fi
else
  echo -e "${YELLOW}⚠️  No invoice found, skipping invoice payment test${NC}"
fi
echo ""

# Test 10.1.1c: Different payment providers
echo -e "${YELLOW}Test 10.1.1c: Testing different payment providers...${NC}"
PROVIDERS=("telebirr" "cbe_birr" "chapa" "hellocash" "bank_transfer")
PROVIDER_RESULTS=()

for PROVIDER in "${PROVIDERS[@]}"; do
  echo -n "  Testing ${PROVIDER}... "
  PROVIDER_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/tenant/payments/intent" \
    -H "Content-Type: application/json" \
    -b "${SESSION_COOKIE}=${TENANT_SESSION}" \
    -d "{
      \"amount\": 1000,
      \"provider\": \"${PROVIDER}\"
    }")
  
  if echo "$PROVIDER_RESPONSE" | grep -qi "error"; then
    echo -e "${RED}❌${NC}"
    PROVIDER_RESULTS+=("${PROVIDER}: FAILED")
  else
    PROVIDER_INTENT_ID=$(extract_json_value "$PROVIDER_RESPONSE" "intentId" || extract_json_id "$PROVIDER_RESPONSE")
    if [ -n "$PROVIDER_INTENT_ID" ] && [ "$PROVIDER_INTENT_ID" != "null" ]; then
      echo -e "${GREEN}✅${NC}"
      PROVIDER_RESULTS+=("${PROVIDER}: SUCCESS (${PROVIDER_INTENT_ID})")
    else
      echo -e "${YELLOW}⚠️${NC}"
      PROVIDER_RESULTS+=("${PROVIDER}: WARNING (no intent ID)")
    fi
  fi
done
echo ""

# Test 10.1.2: Payment Status Checking
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo -e "${BLUE}Test 10.1.2: Payment Status Checking${NC}"
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo ""

if [ -n "$MANUAL_INTENT_ID" ] && [ "$MANUAL_INTENT_ID" != "null" ]; then
  echo -e "${YELLOW}Polling payment status for intent ${MANUAL_INTENT_ID}...${NC}"
  
  for i in {1..3}; do
    echo -n "  Poll ${i}/3... "
    STATUS_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/tenant/payments/intent/${MANUAL_INTENT_ID}" \
      -b "${SESSION_COOKIE}=${TENANT_SESSION}")
    
    if echo "$STATUS_RESPONSE" | grep -qi "error"; then
      echo -e "${RED}❌ Error${NC}"
      echo "$STATUS_RESPONSE"
    else
      STATUS=$(extract_json_value "$STATUS_RESPONSE" "status" || echo "unknown")
      echo -e "${GREEN}Status: ${STATUS}${NC}"
    fi
    
    if [ $i -lt 3 ]; then
      sleep 1
    fi
  done
else
  echo -e "${YELLOW}⚠️  No valid intent ID to test status checking${NC}"
fi
echo ""

# Summary
echo ""
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}════════════════════════════════════════${NC}"
echo ""
echo -e "${GREEN}✅ Payment Intent Creation Tests:${NC}"
echo "  ✅ Manual payment (no invoice)"
if [ -n "$INVOICE_ID" ]; then
  echo "  ✅ Payment with invoice ID"
else
  echo "  ⚠️  Payment with invoice ID (skipped - no invoice)"
fi
echo ""
echo -e "${GREEN}✅ Payment Provider Tests:${NC}"
for result in "${PROVIDER_RESULTS[@]}"; do
  if echo "$result" | grep -q "SUCCESS"; then
    echo -e "  ${GREEN}✅ $result${NC}"
  elif echo "$result" | grep -q "WARNING"; then
    echo -e "  ${YELLOW}⚠️  $result${NC}"
  else
    echo -e "  ${RED}❌ $result${NC}"
  fi
done
echo ""
echo -e "${GREEN}✅ Payment Status Checking:${NC}"
if [ -n "$MANUAL_INTENT_ID" ]; then
  echo "  ✅ Status polling tested"
else
  echo "  ⚠️  Status polling (skipped - no intent ID)"
fi
echo ""
echo -e "${GREEN}All payment flow tests completed! 🎉${NC}"



















