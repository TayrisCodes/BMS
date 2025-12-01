#!/bin/bash

# Test script for Payment CRUD API endpoints
# Make sure the dev server is running: npm run dev

BASE_URL="http://localhost:3000"
SESSION_COOKIE="bms_session"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== BMS Payment API Test Script ===${NC}\n"

# Check if server is running
if ! curl -s "$BASE_URL/api/health" > /dev/null 2>&1; then
  echo -e "${RED}❌ Server is not running at $BASE_URL${NC}"
  echo -e "${YELLOW}Please start the dev server with: npm run dev${NC}"
  exit 1
fi

# Step 1: Login as ORG_ADMIN
echo -e "${YELLOW}Step 1: Logging in as ORG_ADMIN...${NC}"
ORG_ADMIN_LOGIN=$(curl -s -c /tmp/bms_payments_cookies.txt -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"identifier": "admin@example.com", "password": "ChangeMe123!"}')

echo "$ORG_ADMIN_LOGIN"

ORG_ADMIN_SESSION=$(grep "$SESSION_COOKIE" /tmp/bms_payments_cookies.txt | awk '{print $7}')

if [ -z "$ORG_ADMIN_SESSION" ]; then
  echo -e "${RED}❌ Failed to get ORG_ADMIN session token${NC}"
  exit 1
fi

echo -e "${GREEN}✅ ORG_ADMIN session token obtained${NC}\n"

# Step 2: Get or create an invoice for payment testing
echo -e "${YELLOW}Step 2: Getting or creating an invoice...${NC}"

# First, get existing invoice or create one
LIST_INVOICES=$(curl -s -X GET "$BASE_URL/api/invoices?status=draft" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")

INVOICE_ID=$(echo "$LIST_INVOICES" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
TENANT_ID=$(echo "$LIST_INVOICES" | grep -o '"tenantId":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$INVOICE_ID" ]; then
  echo -e "${YELLOW}No draft invoice found, creating one...${NC}"
  
  # Get or create lease first
  LIST_LEASES=$(curl -s -X GET "$BASE_URL/api/leases?status=active" \
    -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
    -H "Content-Type: application/json")
  
  LEASE_ID=$(echo "$LIST_LEASES" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
  TENANT_ID=$(echo "$LIST_LEASES" | grep -o '"tenantId":"[^"]*"' | head -1 | cut -d'"' -f4)
  UNIT_ID=$(echo "$LIST_LEASES" | grep -o '"unitId":"[^"]*"' | head -1 | cut -d'"' -f4)
  
  if [ -z "$LEASE_ID" ]; then
    echo -e "${RED}❌ No active lease found. Please create a lease first.${NC}"
    exit 1
  fi
  
  # Create invoice
  ISSUE_DATE=$(date -u +"%Y-%m-%dT00:00:00.000Z")
  DUE_DATE=$(node -e "const d = new Date(); d.setDate(d.getDate() + 7); console.log(d.toISOString())" 2>/dev/null || echo "")
  PERIOD_START=$(date -u +"%Y-%m-01T00:00:00.000Z")
  PERIOD_END=$(node -e "const d = new Date(); d.setMonth(d.getMonth() + 1); d.setDate(0); console.log(d.toISOString().split('T')[0] + 'T23:59:59.000Z')" 2>/dev/null || echo "")
  
  CREATE_INVOICE=$(curl -s -X POST "$BASE_URL/api/invoices" \
    -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
    -H "Content-Type: application/json" \
    -d "{
      \"leaseId\": \"$LEASE_ID\",
      \"tenantId\": \"$TENANT_ID\",
      \"unitId\": \"$UNIT_ID\",
      \"issueDate\": \"$ISSUE_DATE\",
      \"dueDate\": \"$DUE_DATE\",
      \"periodStart\": \"$PERIOD_START\",
      \"periodEnd\": \"$PERIOD_END\",
      \"items\": [
        {
          \"description\": \"Monthly Rent\",
          \"amount\": 15000,
          \"type\": \"rent\"
        }
      ],
      \"status\": \"sent\"
    }")
  
  INVOICE_ID=$(echo "$CREATE_INVOICE" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
fi

if [ -z "$INVOICE_ID" ] || [ -z "$TENANT_ID" ]; then
  echo -e "${RED}❌ Failed to get or create invoice${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Invoice ID: $INVOICE_ID, Tenant ID: $TENANT_ID${NC}\n"

# Step 3: Test GET /api/payments (List payments - should be empty initially)
echo -e "${YELLOW}Step 3: GET /api/payments (List payments)...${NC}"
LIST_PAYMENTS=$(curl -s -X GET "$BASE_URL/api/payments" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$LIST_PAYMENTS"
echo ""

# Step 4: Test POST /api/payments (Create payment for invoice)
echo -e "${YELLOW}Step 4: POST /api/payments (Create payment for invoice)...${NC}"

PAYMENT_DATE=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

CREATE_PAYMENT=$(curl -s -X POST "$BASE_URL/api/payments" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d "{
    \"invoiceId\": \"$INVOICE_ID\",
    \"tenantId\": \"$TENANT_ID\",
    \"amount\": 15000,
    \"paymentMethod\": \"telebirr\",
    \"paymentDate\": \"$PAYMENT_DATE\",
    \"referenceNumber\": \"TXN-001-$(date +%s)\",
    \"status\": \"completed\",
    \"notes\": \"Payment via Telebirr\"
  }")

echo "$CREATE_PAYMENT"

PAYMENT_ID=$(echo "$CREATE_PAYMENT" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$PAYMENT_ID" ]; then
  echo -e "${RED}❌ Failed to create payment${NC}"
  echo -e "${YELLOW}Response: $CREATE_PAYMENT${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Payment created with ID: $PAYMENT_ID${NC}\n"

# Step 5: Verify invoice status updated to paid
echo -e "${YELLOW}Step 5: GET /api/invoices/$INVOICE_ID (Verify invoice status updated to paid)...${NC}"
GET_INVOICE=$(curl -s -X GET "$BASE_URL/api/invoices/$INVOICE_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$GET_INVOICE"

INVOICE_STATUS=$(echo "$GET_INVOICE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
if [ "$INVOICE_STATUS" = "paid" ]; then
  echo -e "${GREEN}✅ Invoice status correctly updated to paid${NC}"
else
  echo -e "${YELLOW}⚠️  Invoice status: $INVOICE_STATUS (expected: paid)${NC}"
fi
echo ""

# Step 6: Test GET /api/payments/[id] (Get single payment)
echo -e "${YELLOW}Step 6: GET /api/payments/$PAYMENT_ID (Get single payment)...${NC}"
GET_PAYMENT=$(curl -s -X GET "$BASE_URL/api/payments/$PAYMENT_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$GET_PAYMENT"
echo ""

# Step 7: Test GET /api/payments with filters
echo -e "${YELLOW}Step 7: GET /api/payments?tenantId=$TENANT_ID (Filter by tenant)...${NC}"
FILTER_BY_TENANT=$(curl -s -X GET "$BASE_URL/api/payments?tenantId=$TENANT_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$FILTER_BY_TENANT"
echo ""

echo -e "${YELLOW}Step 7b: GET /api/payments?invoiceId=$INVOICE_ID (Filter by invoice)...${NC}"
FILTER_BY_INVOICE=$(curl -s -X GET "$BASE_URL/api/payments?invoiceId=$INVOICE_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$FILTER_BY_INVOICE"
echo ""

echo -e "${YELLOW}Step 7c: GET /api/payments?status=completed (Filter by status)...${NC}"
FILTER_BY_STATUS=$(curl -s -X GET "$BASE_URL/api/payments?status=completed" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$FILTER_BY_STATUS"
echo ""

# Step 8: Test idempotency - Try to create duplicate payment with same referenceNumber
echo -e "${YELLOW}Step 8: POST /api/payments (Try duplicate referenceNumber - should fail)...${NC}"
REF_NUM=$(echo "$CREATE_PAYMENT" | grep -o '"referenceNumber":"[^"]*"' | cut -d'"' -f4)

if [ -n "$REF_NUM" ]; then
  DUPLICATE_PAYMENT=$(curl -s -X POST "$BASE_URL/api/payments" \
    -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
    -H "Content-Type: application/json" \
    -d "{
      \"invoiceId\": \"$INVOICE_ID\",
      \"tenantId\": \"$TENANT_ID\",
      \"amount\": 15000,
      \"paymentMethod\": \"telebirr\",
      \"paymentDate\": \"$PAYMENT_DATE\",
      \"referenceNumber\": \"$REF_NUM\",
      \"status\": \"completed\"
    }")
  echo "$DUPLICATE_PAYMENT"
  echo ""
fi

# Step 9: Test POST /api/payments (Create manual payment without invoice)
echo -e "${YELLOW}Step 9: POST /api/payments (Create manual payment without invoice)...${NC}"
CREATE_MANUAL_PAYMENT=$(curl -s -X POST "$BASE_URL/api/payments" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d "{
    \"tenantId\": \"$TENANT_ID\",
    \"amount\": 5000,
    \"paymentMethod\": \"cash\",
    \"paymentDate\": \"$PAYMENT_DATE\",
    \"referenceNumber\": \"CASH-$(date +%s)\",
    \"status\": \"completed\",
    \"notes\": \"Manual cash payment\"
  }")

echo "$CREATE_MANUAL_PAYMENT"

MANUAL_PAYMENT_ID=$(echo "$CREATE_MANUAL_PAYMENT" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$MANUAL_PAYMENT_ID" ]; then
  echo -e "${GREEN}✅ Manual payment created with ID: $MANUAL_PAYMENT_ID${NC}"
fi
echo ""

# Step 10: Test PATCH /api/payments/[id] (Update payment - create pending payment first)
echo -e "${YELLOW}Step 10: POST /api/payments (Create pending payment for update test)...${NC}"
CREATE_PENDING=$(curl -s -X POST "$BASE_URL/api/payments" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d "{
    \"tenantId\": \"$TENANT_ID\",
    \"amount\": 3000,
    \"paymentMethod\": \"bank_transfer\",
    \"paymentDate\": \"$PAYMENT_DATE\",
    \"referenceNumber\": \"PENDING-$(date +%s)\",
    \"status\": \"pending\",
    \"notes\": \"Pending bank transfer\"
  }")

PENDING_PAYMENT_ID=$(echo "$CREATE_PENDING" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "$CREATE_PENDING"
echo ""

# Step 11: Test PATCH /api/payments/[id] (Update pending payment)
echo -e "${YELLOW}Step 11: PATCH /api/payments/$PENDING_PAYMENT_ID (Update pending payment)...${NC}"
UPDATE_PENDING=$(curl -s -X PATCH "$BASE_URL/api/payments/$PENDING_PAYMENT_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 3500,
    "notes": "Updated amount and notes",
    "status": "completed"
  }')
echo "$UPDATE_PENDING"
echo ""

# Step 12: Test DELETE /api/payments/[id] (Refund payment)
echo -e "${YELLOW}Step 12: DELETE /api/payments/$PAYMENT_ID (Refund payment)...${NC}"
REFUND_PAYMENT=$(curl -s -X DELETE "$BASE_URL/api/payments/$PAYMENT_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$REFUND_PAYMENT"
echo ""

# Step 13: Verify payment status changed to refunded
echo -e "${YELLOW}Step 13: GET /api/payments/$PAYMENT_ID (Verify refund)...${NC}"
GET_REFUNDED=$(curl -s -X GET "$BASE_URL/api/payments/$PAYMENT_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$GET_REFUNDED"

PAYMENT_STATUS=$(echo "$GET_REFUNDED" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
if [ "$PAYMENT_STATUS" = "refunded" ]; then
  echo -e "${GREEN}✅ Payment refunded successfully (status: refunded)${NC}"
else
  echo -e "${YELLOW}⚠️  Payment status: $PAYMENT_STATUS (expected: refunded)${NC}"
fi
echo ""

# Step 14: Verify invoice status updated back to sent (if total paid < invoice total)
echo -e "${YELLOW}Step 14: GET /api/invoices/$INVOICE_ID (Verify invoice status after refund)...${NC}"
GET_INVOICE_AFTER=$(curl -s -X GET "$BASE_URL/api/invoices/$INVOICE_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$GET_INVOICE_AFTER"

INVOICE_STATUS_AFTER=$(echo "$GET_INVOICE_AFTER" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
echo -e "${YELLOW}Invoice status after refund: $INVOICE_STATUS_AFTER${NC}"
echo ""

# Step 15: Test error case - Try to refund non-completed payment
echo -e "${YELLOW}Step 15: DELETE /api/payments/$PENDING_PAYMENT_ID (Try to refund pending payment - should fail if status wasn't completed)...${NC}"
# First, verify it's completed
GET_PENDING=$(curl -s -X GET "$BASE_URL/api/payments/$PENDING_PAYMENT_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")

PENDING_STATUS=$(echo "$GET_PENDING" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

if [ "$PENDING_STATUS" = "completed" ]; then
  REFUND_PENDING=$(curl -s -X DELETE "$BASE_URL/api/payments/$PENDING_PAYMENT_ID" \
    -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
    -H "Content-Type: application/json")
  echo "$REFUND_PENDING"
else
  echo -e "${YELLOW}Payment is not completed, skipping refund test${NC}"
fi
echo ""

echo -e "${GREEN}=== All tests completed! ===${NC}"

# Cleanup
rm -f /tmp/bms_payments_cookies.txt

































