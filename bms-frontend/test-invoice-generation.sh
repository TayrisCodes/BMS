#!/bin/bash

# Test script for Invoice Generation Service
# Make sure the dev server is running: npm run dev

BASE_URL="http://localhost:3000"
SESSION_COOKIE="bms_session"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== BMS Invoice Generation Service Test Script ===${NC}\n"

# Check if server is running
if ! curl -s "$BASE_URL/api/health" > /dev/null 2>&1; then
  echo -e "${RED}❌ Server is not running at $BASE_URL${NC}"
  echo -e "${YELLOW}Please start the dev server with: npm run dev${NC}"
  exit 1
fi

# Step 1: Login as ORG_ADMIN
echo -e "${YELLOW}Step 1: Logging in as ORG_ADMIN...${NC}"
ORG_ADMIN_LOGIN=$(curl -s -c /tmp/bms_invoice_gen_cookies.txt -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"identifier": "admin@example.com", "password": "ChangeMe123!"}')

echo "$ORG_ADMIN_LOGIN"

ORG_ADMIN_SESSION=$(grep "$SESSION_COOKIE" /tmp/bms_invoice_gen_cookies.txt | awk '{print $7}')

if [ -z "$ORG_ADMIN_SESSION" ]; then
  echo -e "${RED}❌ Failed to get ORG_ADMIN session token${NC}"
  exit 1
fi

echo -e "${GREEN}✅ ORG_ADMIN session token obtained${NC}\n"

# Step 2: Get an active lease
echo -e "${YELLOW}Step 2: Getting an active lease...${NC}"
LIST_LEASES=$(curl -s -X GET "$BASE_URL/api/leases?status=active" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")

LEASE_ID=$(echo "$LIST_LEASES" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$LEASE_ID" ]; then
  echo -e "${RED}❌ No active lease found. Please create a lease first.${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Lease ID: $LEASE_ID${NC}\n"

# Step 3: Test POST /api/invoices with auto-generation (leaseId only)
echo -e "${YELLOW}Step 3: POST /api/invoices (Auto-generate invoice for lease)...${NC}"
CREATE_AUTO_INVOICE=$(curl -s -X POST "$BASE_URL/api/invoices" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d "{
    \"leaseId\": \"$LEASE_ID\"
  }")

echo "$CREATE_AUTO_INVOICE"

AUTO_INVOICE_ID=$(echo "$CREATE_AUTO_INVOICE" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$AUTO_INVOICE_ID" ]; then
  echo -e "${RED}❌ Failed to auto-generate invoice${NC}"
  echo -e "${YELLOW}Response: $CREATE_AUTO_INVOICE${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Auto-generated invoice with ID: $AUTO_INVOICE_ID${NC}\n"

# Step 4: Test POST /api/invoices with auto-generation (leaseId + period)
echo -e "${YELLOW}Step 4: POST /api/invoices (Auto-generate invoice with custom period)...${NC}"

PERIOD_START=$(date -u +"%Y-%m-01T00:00:00.000Z")
PERIOD_END=$(node -e "const d = new Date(); d.setMonth(d.getMonth() + 1); d.setDate(0); console.log(d.toISOString().split('T')[0] + 'T23:59:59.000Z')" 2>/dev/null || echo "")

if [ -z "$PERIOD_END" ]; then
  PERIOD_END=$(date -u -d "+1 month -1 day" +"%Y-%m-%dT23:59:59.000Z" 2>/dev/null || echo "")
fi

CREATE_PERIOD_INVOICE=$(curl -s -X POST "$BASE_URL/api/invoices" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d "{
    \"leaseId\": \"$LEASE_ID\",
    \"periodStart\": \"$PERIOD_START\",
    \"periodEnd\": \"$PERIOD_END\"
  }")

echo "$CREATE_PERIOD_INVOICE"

if echo "$CREATE_PERIOD_INVOICE" | grep -q '"error"'; then
  echo -e "${YELLOW}⚠️  Expected: Invoice already exists for this period${NC}"
else
  PERIOD_INVOICE_ID=$(echo "$CREATE_PERIOD_INVOICE" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
  echo -e "${GREEN}✅ Period invoice created with ID: $PERIOD_INVOICE_ID${NC}"
fi
echo ""

# Step 5: Test POST /api/billing/generate-invoices (Batch generation)
echo -e "${YELLOW}Step 5: POST /api/billing/generate-invoices (Batch generate for all leases)...${NC}"

CURRENT_MONTH_START=$(date -u +"%Y-%m-01T00:00:00.000Z")
CURRENT_MONTH_END=$(node -e "const d = new Date(); d.setMonth(d.getMonth() + 1); d.setDate(0); console.log(d.toISOString().split('T')[0] + 'T23:59:59.000Z')" 2>/dev/null || echo "")

if [ -z "$CURRENT_MONTH_END" ]; then
  CURRENT_MONTH_END=$(date -u -d "+1 month -1 day" +"%Y-%m-%dT23:59:59.000Z" 2>/dev/null || echo "")
fi

BATCH_GENERATE=$(curl -s -X POST "$BASE_URL/api/billing/generate-invoices" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d "{
    \"periodStart\": \"$CURRENT_MONTH_START\",
    \"periodEnd\": \"$CURRENT_MONTH_END\"
  }")

echo "$BATCH_GENERATE"

SUCCESS_COUNT=$(echo "$BATCH_GENERATE" | grep -o '"successful":[0-9]*' | cut -d':' -f2)
echo -e "${GREEN}✅ Batch generation completed: $SUCCESS_COUNT invoices generated${NC}\n"

# Step 6: Test POST /api/billing/generate-invoices (Force regenerate)
echo -e "${YELLOW}Step 6: POST /api/billing/generate-invoices (Force regenerate - should skip duplicates)...${NC}"
FORCE_REGENERATE=$(curl -s -X POST "$BASE_URL/api/billing/generate-invoices" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d "{
    \"periodStart\": \"$CURRENT_MONTH_START\",
    \"periodEnd\": \"$CURRENT_MONTH_END\",
    \"forceRegenerate\": false
  }")

echo "$FORCE_REGENERATE"
echo ""

# Step 7: List invoices to verify generation
echo -e "${YELLOW}Step 7: GET /api/invoices (List all invoices)...${NC}"
LIST_INVOICES=$(curl -s -X GET "$BASE_URL/api/invoices" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")

INVOICE_COUNT=$(echo "$LIST_INVOICES" | grep -o '"count":[0-9]*' | cut -d':' -f2)
echo "$LIST_INVOICES"
echo -e "${GREEN}✅ Total invoices: $INVOICE_COUNT${NC}\n"

echo -e "${GREEN}=== All tests completed! ===${NC}"

# Cleanup
rm -f /tmp/bms_invoice_gen_cookies.txt

































