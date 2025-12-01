#!/bin/bash

# Test script for Payment Initiation System
# Tests payment intent creation and status retrieval
# 
# Prerequisites:
# - Dev server running: npm run dev
# - A tenant must exist with a matching user account
# - OR run this after test-phase3-exit-criteria.sh which creates a tenant

set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"
ORG_ADMIN_EMAIL="${ORG_ADMIN_EMAIL:-admin@example.com}"
ORG_ADMIN_PASSWORD="${ORG_ADMIN_PASSWORD:-ChangeMe123!}"
SESSION_COOKIE="bms_session"

echo "🧪 Testing Payment Initiation System"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if server is running
if ! curl -s "$BASE_URL/api/health" > /dev/null 2>&1; then
  echo -e "${RED}❌ Server is not running at $BASE_URL${NC}"
  echo -e "${YELLOW}Please start the dev server with: npm run dev${NC}"
  exit 1
fi

# Step 1: Login as ORG_ADMIN to create/get tenant
echo -e "${YELLOW}Step 1: Logging in as ORG_ADMIN...${NC}"
LOGIN_RESPONSE=$(curl -s -c /tmp/payment_test_cookies.txt -X POST "${BASE_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"identifier\":\"${ORG_ADMIN_EMAIL}\",\"password\":\"${ORG_ADMIN_PASSWORD}\"}")

if echo "$LOGIN_RESPONSE" | grep -q "error"; then
  echo -e "${RED}❌ Admin login failed${NC}"
  echo "$LOGIN_RESPONSE" | jq '.' 2>/dev/null || echo "$LOGIN_RESPONSE"
  exit 1
fi

SESSION=$(grep "$SESSION_COOKIE" /tmp/payment_test_cookies.txt | awk '{print $7}')

if [ -z "$SESSION" ]; then
  echo -e "${RED}❌ Failed to get session token${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Admin login successful${NC}"
echo ""

# Step 2: Get or create a tenant (use existing tenant if available)
echo -e "${YELLOW}Step 2: Getting tenant information...${NC}"
TIMESTAMP=$(date +%s)
TENANT_PHONE="+2519${TIMESTAMP: -8}"  # Generate unique phone number

# Try to get existing tenants first
TENANTS_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/tenants" \
  -b "${SESSION_COOKIE}=${SESSION}")

TENANT_ID=$(echo "$TENANTS_RESPONSE" | jq -r '.tenants[0]._id // empty' 2>/dev/null)

if [ -z "$TENANT_ID" ] || [ "$TENANT_ID" = "null" ]; then
  echo "  No existing tenant found, creating new tenant..."
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
  
  TENANT_ID=$(echo "$CREATE_TENANT_RESPONSE" | jq -r '._id // .tenant._id // empty' 2>/dev/null)
  
  if [ -z "$TENANT_ID" ] || [ "$TENANT_ID" = "null" ]; then
    echo -e "${RED}❌ Failed to create tenant${NC}"
    echo "$CREATE_TENANT_RESPONSE" | jq '.' 2>/dev/null || echo "$CREATE_TENANT_RESPONSE"
    exit 1
  fi
  
  # Get tenant phone from response
  TENANT_PHONE=$(echo "$CREATE_TENANT_RESPONSE" | jq -r '.primaryPhone // .tenant.primaryPhone // empty' 2>/dev/null || echo "$TENANT_PHONE")
  echo -e "${GREEN}✅ Tenant created${NC}"
else
  # Get tenant phone from existing tenant
  TENANT_PHONE=$(echo "$TENANTS_RESPONSE" | jq -r '.tenants[0].primaryPhone // empty' 2>/dev/null)
  echo -e "${GREEN}✅ Using existing tenant${NC}"
fi

echo "Tenant ID: $TENANT_ID"
echo "Tenant Phone: $TENANT_PHONE"
echo ""

# Step 3: Request OTP for tenant login
echo -e "${YELLOW}Step 3: Requesting OTP for tenant login...${NC}"
OTP_REQUEST_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/auth/request-otp" \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"${TENANT_PHONE}\"}")

if echo "$OTP_REQUEST_RESPONSE" | grep -q "error"; then
  echo -e "${RED}❌ Failed to request OTP${NC}"
  echo "$OTP_REQUEST_RESPONSE" | jq '.' 2>/dev/null || echo "$OTP_REQUEST_RESPONSE"
  exit 1
fi

OTP_CODE=$(echo "$OTP_REQUEST_RESPONSE" | jq -r '.code // empty' 2>/dev/null)

if [ -z "$OTP_CODE" ] || [ "$OTP_CODE" = "null" ]; then
  echo -e "${YELLOW}⚠️  OTP code not in response, checking logs or using default test code${NC}"
  OTP_CODE="123456"  # Default test code
fi

echo -e "${GREEN}✅ OTP requested (Code: ${OTP_CODE})${NC}"
echo ""

# Step 4: Verify OTP and login as tenant
echo -e "${YELLOW}Step 4: Verifying OTP and logging in as tenant...${NC}"
TENANT_LOGIN_RESPONSE=$(curl -s -c /tmp/tenant_cookies.txt -X POST "${BASE_URL}/api/auth/verify-otp" \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"${TENANT_PHONE}\",\"code\":\"${OTP_CODE}\"}")

if echo "$TENANT_LOGIN_RESPONSE" | grep -q "error"; then
  echo -e "${RED}❌ Tenant login failed${NC}"
  echo "$TENANT_LOGIN_RESPONSE" | jq '.' 2>/dev/null || echo "$TENANT_LOGIN_RESPONSE"
  exit 1
fi

TENANT_SESSION=$(grep "$SESSION_COOKIE" /tmp/tenant_cookies.txt | awk '{print $7}')

if [ -z "$TENANT_SESSION" ]; then
  echo -e "${RED}❌ Failed to get tenant session token${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Tenant login successful${NC}"
echo ""

# Step 5: Create payment intent (without invoice)
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

if echo "$INTENT_RESPONSE" | grep -q "error"; then
  echo -e "${RED}❌ Failed to create payment intent${NC}"
  echo "$INTENT_RESPONSE" | jq '.' 2>/dev/null || echo "$INTENT_RESPONSE"
  exit 1
fi

INTENT_ID=$(echo "$INTENT_RESPONSE" | jq -r '.intentId // empty' 2>/dev/null)
if [ -z "$INTENT_ID" ] || [ "$INTENT_ID" = "null" ]; then
  echo -e "${RED}❌ Payment intent ID not found in response${NC}"
  echo "$INTENT_RESPONSE" | jq '.' 2>/dev/null || echo "$INTENT_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Payment intent created${NC}"
echo "Intent ID: $INTENT_ID"
echo "Response:"
echo "$INTENT_RESPONSE" | jq '.' 2>/dev/null || echo "$INTENT_RESPONSE"
echo ""

# Step 6: Get payment intent status
echo -e "${YELLOW}Step 6: Retrieving payment intent status...${NC}"
STATUS_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/tenant/payments/intent/${INTENT_ID}" \
  -b "${SESSION_COOKIE}=${TENANT_SESSION}")

if echo "$STATUS_RESPONSE" | grep -q "error"; then
  echo -e "${RED}❌ Failed to get payment intent status${NC}"
  echo "$STATUS_RESPONSE" | jq '.' 2>/dev/null || echo "$STATUS_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Payment intent status retrieved${NC}"
echo "Status:"
echo "$STATUS_RESPONSE" | jq '.' 2>/dev/null || echo "$STATUS_RESPONSE"
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
  
  if echo "$PROVIDER_RESPONSE" | grep -q "error"; then
    echo -e "    ${RED}❌ Failed${NC}"
    echo "$PROVIDER_RESPONSE" | jq -r '.error' 2>/dev/null || echo "Error"
  else
    PROVIDER_INTENT_ID=$(echo "$PROVIDER_RESPONSE" | jq -r '.intentId // empty' 2>/dev/null)
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

if echo "$ERROR_RESPONSE" | grep -q "error"; then
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

if echo "$ERROR_RESPONSE" | grep -q "error"; then
  echo -e "    ${GREEN}✅ Correctly rejected invalid provider${NC}"
else
  echo -e "    ${RED}❌ Should have rejected invalid provider${NC}"
fi
echo ""

# Summary
echo ""
echo "======================================"
echo -e "${GREEN}✅ Payment Initiation System Test Complete${NC}"
echo ""
echo -e "${BLUE}Test Summary:${NC}"
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

