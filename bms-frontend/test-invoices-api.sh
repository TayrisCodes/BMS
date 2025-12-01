#!/bin/bash

# Test script for Invoice CRUD API endpoints
# Make sure the dev server is running: npm run dev

BASE_URL="http://localhost:3000"
SESSION_COOKIE="bms_session"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== BMS Invoice API Test Script ===${NC}\n"

# Check if server is running
if ! curl -s "$BASE_URL/api/health" > /dev/null 2>&1; then
  echo -e "${RED}❌ Server is not running at $BASE_URL${NC}"
  echo -e "${YELLOW}Please start the dev server with: npm run dev${NC}"
  exit 1
fi

# Step 1: Login as ORG_ADMIN
echo -e "${YELLOW}Step 1: Logging in as ORG_ADMIN...${NC}"
ORG_ADMIN_LOGIN=$(curl -s -c /tmp/bms_invoices_cookies.txt -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"identifier": "admin@example.com", "password": "ChangeMe123!"}')

echo "$ORG_ADMIN_LOGIN"

ORG_ADMIN_SESSION=$(grep "$SESSION_COOKIE" /tmp/bms_invoices_cookies.txt | awk '{print $7}')

if [ -z "$ORG_ADMIN_SESSION" ]; then
  echo -e "${RED}❌ Failed to get ORG_ADMIN session token${NC}"
  exit 1
fi

echo -e "${GREEN}✅ ORG_ADMIN session token obtained${NC}\n"

# Step 2: Get or create a lease (required for invoices)
echo -e "${YELLOW}Step 2: Getting or creating a lease...${NC}"

# First, get or create building
LIST_BUILDINGS=$(curl -s -X GET "$BASE_URL/api/buildings?status=active" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")

BUILDING_ID=$(echo "$LIST_BUILDINGS" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$BUILDING_ID" ]; then
  CREATE_BUILDING=$(curl -s -X POST "$BASE_URL/api/buildings" \
    -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Invoice Test Building",
      "address": {"street": "Test St", "city": "Addis Ababa"},
      "buildingType": "residential",
      "status": "active"
    }')
  BUILDING_ID=$(echo "$CREATE_BUILDING" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
fi

# Get or create unit
LIST_UNITS=$(curl -s -X GET "$BASE_URL/api/units?buildingId=$BUILDING_ID&status=available" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")

UNIT_ID=$(echo "$LIST_UNITS" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$UNIT_ID" ]; then
  CREATE_UNIT=$(curl -s -X POST "$BASE_URL/api/units" \
    -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
    -H "Content-Type: application/json" \
    -d "{
      \"buildingId\": \"$BUILDING_ID\",
      \"unitNumber\": \"INV-101\",
      \"unitType\": \"apartment\",
      \"status\": \"available\"
    }")
  UNIT_ID=$(echo "$CREATE_UNIT" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
fi

# Get or create tenant
LIST_TENANTS=$(curl -s -X GET "$BASE_URL/api/tenants?status=active" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")

TENANT_ID=$(echo "$LIST_TENANTS" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$TENANT_ID" ]; then
  CREATE_TENANT=$(curl -s -X POST "$BASE_URL/api/tenants" \
    -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
    -H "Content-Type: application/json" \
    -d '{
      "firstName": "Invoice",
      "lastName": "Test",
      "primaryPhone": "+251912345678",
      "status": "active"
    }')
  TENANT_ID=$(echo "$CREATE_TENANT" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
fi

# Get or create lease
LIST_LEASES=$(curl -s -X GET "$BASE_URL/api/leases?tenantId=$TENANT_ID&status=active" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")

LEASE_ID=$(echo "$LIST_LEASES" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$LEASE_ID" ]; then
  START_DATE=$(date -u +"%Y-%m-%dT00:00:00.000Z")
  END_DATE=$(node -e "const d = new Date(); d.setMonth(d.getMonth() + 12); console.log(d.toISOString())" 2>/dev/null || echo "")
  
  if [ -z "$END_DATE" ]; then
    END_DATE=$(date -u -d "+12 months" +"%Y-%m-%dT00:00:00.000Z" 2>/dev/null || echo "")
  fi

  CREATE_LEASE=$(curl -s -X POST "$BASE_URL/api/leases" \
    -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
    -H "Content-Type: application/json" \
    -d "{
      \"tenantId\": \"$TENANT_ID\",
      \"unitId\": \"$UNIT_ID\",
      \"startDate\": \"$START_DATE\",
      \"endDate\": \"$END_DATE\",
      \"rentAmount\": 15000,
      \"billingCycle\": \"monthly\",
      \"dueDay\": 5,
      \"status\": \"active\"
    }")
  LEASE_ID=$(echo "$CREATE_LEASE" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
fi

if [ -z "$LEASE_ID" ]; then
  echo -e "${RED}❌ Failed to get or create lease${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Lease ID: $LEASE_ID${NC}\n"

# Step 3: Test GET /api/invoices (List invoices - should be empty initially)
echo -e "${YELLOW}Step 3: GET /api/invoices (List invoices)...${NC}"
LIST_INVOICES=$(curl -s -X GET "$BASE_URL/api/invoices" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$LIST_INVOICES"
echo ""

# Step 4: Test POST /api/invoices (Create invoice)
echo -e "${YELLOW}Step 4: POST /api/invoices (Create invoice)...${NC}"

# Calculate dates
ISSUE_DATE=$(date -u +"%Y-%m-%dT00:00:00.000Z")
DUE_DATE=$(node -e "const d = new Date(); d.setDate(d.getDate() + 7); console.log(d.toISOString())" 2>/dev/null || echo "")
PERIOD_START=$(date -u +"%Y-%m-01T00:00:00.000Z")
PERIOD_END=$(node -e "const d = new Date(); d.setMonth(d.getMonth() + 1); d.setDate(0); console.log(d.toISOString().split('T')[0] + 'T23:59:59.000Z')" 2>/dev/null || echo "")

if [ -z "$DUE_DATE" ] || [ -z "$PERIOD_END" ]; then
  # Fallback
  DUE_DATE=$(date -u -d "+7 days" +"%Y-%m-%dT00:00:00.000Z" 2>/dev/null || echo "")
fi

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
      },
      {
        \"description\": \"Maintenance Fee\",
        \"amount\": 500,
        \"type\": \"charge\"
      }
    ],
    \"tax\": 0,
    \"status\": \"draft\"
  }")

echo "$CREATE_INVOICE"

INVOICE_ID=$(echo "$CREATE_INVOICE" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
INVOICE_NUMBER=$(echo "$CREATE_INVOICE" | grep -o '"invoiceNumber":"[^"]*"' | cut -d'"' -f4)

if [ -z "$INVOICE_ID" ]; then
  echo -e "${RED}❌ Failed to create invoice${NC}"
  echo -e "${YELLOW}Response: $CREATE_INVOICE${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Invoice created with ID: $INVOICE_ID, Number: $INVOICE_NUMBER${NC}\n"

# Step 5: Test GET /api/invoices/[id] (Get single invoice)
echo -e "${YELLOW}Step 5: GET /api/invoices/$INVOICE_ID (Get single invoice)...${NC}"
GET_INVOICE=$(curl -s -X GET "$BASE_URL/api/invoices/$INVOICE_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$GET_INVOICE"
echo ""

# Step 6: Test GET /api/invoices with filters
echo -e "${YELLOW}Step 6: GET /api/invoices?tenantId=$TENANT_ID (Filter by tenant)...${NC}"
FILTER_BY_TENANT=$(curl -s -X GET "$BASE_URL/api/invoices?tenantId=$TENANT_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$FILTER_BY_TENANT"
echo ""

echo -e "${YELLOW}Step 6b: GET /api/invoices?leaseId=$LEASE_ID (Filter by lease)...${NC}"
FILTER_BY_LEASE=$(curl -s -X GET "$BASE_URL/api/invoices?leaseId=$LEASE_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$FILTER_BY_LEASE"
echo ""

echo -e "${YELLOW}Step 6c: GET /api/invoices?status=draft (Filter by status)...${NC}"
FILTER_BY_STATUS=$(curl -s -X GET "$BASE_URL/api/invoices?status=draft" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$FILTER_BY_STATUS"
echo ""

# Step 7: Test PATCH /api/invoices/[id] (Update draft invoice)
echo -e "${YELLOW}Step 7: PATCH /api/invoices/$INVOICE_ID (Update draft invoice)...${NC}"
UPDATE_INVOICE=$(curl -s -X PATCH "$BASE_URL/api/invoices/$INVOICE_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "description": "Monthly Rent",
        "amount": 15000,
        "type": "rent"
      },
      {
        "description": "Maintenance Fee",
        "amount": 500,
        "type": "charge"
      },
      {
        "description": "Late Fee",
        "amount": 200,
        "type": "penalty"
      }
    ],
    "notes": "Updated invoice with late fee"
  }')
echo "$UPDATE_INVOICE"
echo ""

# Step 8: Test PATCH /api/invoices/[id] (Update status to sent)
echo -e "${YELLOW}Step 8: PATCH /api/invoices/$INVOICE_ID (Update status to sent)...${NC}"
UPDATE_STATUS_SENT=$(curl -s -X PATCH "$BASE_URL/api/invoices/$INVOICE_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "sent"
  }')
echo "$UPDATE_STATUS_SENT"
echo ""

# Step 9: Test GET /api/invoices/[id] again (Verify status change)
echo -e "${YELLOW}Step 9: GET /api/invoices/$INVOICE_ID (Verify status change)...${NC}"
GET_UPDATED_INVOICE=$(curl -s -X GET "$BASE_URL/api/invoices/$INVOICE_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$GET_UPDATED_INVOICE"

STATUS=$(echo "$GET_UPDATED_INVOICE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
if [ "$STATUS" = "sent" ]; then
  echo -e "${GREEN}✅ Invoice status updated to sent${NC}"
fi
echo ""

# Step 10: Test PATCH /api/invoices/[id] (Mark as paid)
echo -e "${YELLOW}Step 10: PATCH /api/invoices/$INVOICE_ID (Mark as paid)...${NC}"
UPDATE_STATUS_PAID=$(curl -s -X PATCH "$BASE_URL/api/invoices/$INVOICE_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "paid",
    "paidAt": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'"
  }')
echo "$UPDATE_STATUS_PAID"
echo ""

# Step 11: Test GET /api/invoices/[id] again (Verify paid status)
echo -e "${YELLOW}Step 11: GET /api/invoices/$INVOICE_ID (Verify paid status)...${NC}"
GET_PAID_INVOICE=$(curl -s -X GET "$BASE_URL/api/invoices/$INVOICE_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$GET_PAID_INVOICE"

PAID_STATUS=$(echo "$GET_PAID_INVOICE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
if [ "$PAID_STATUS" = "paid" ]; then
  echo -e "${GREEN}✅ Invoice status updated to paid${NC}"
fi
echo ""

# Step 12: Test DELETE /api/invoices/[id] (Try to cancel paid invoice - should fail)
echo -e "${YELLOW}Step 12: DELETE /api/invoices/$INVOICE_ID (Try to cancel paid invoice - should fail)...${NC}"
CANCEL_PAID=$(curl -s -X DELETE "$BASE_URL/api/invoices/$INVOICE_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$CANCEL_PAID"
echo ""

# Step 13: Create another draft invoice for cancellation test
echo -e "${YELLOW}Step 13: POST /api/invoices (Create another draft invoice for cancellation)...${NC}"
CREATE_INVOICE2=$(curl -s -X POST "$BASE_URL/api/invoices" \
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
    \"status\": \"draft\"
  }")

INVOICE_ID2=$(echo "$CREATE_INVOICE2" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "$CREATE_INVOICE2"
echo ""

# Step 14: Test DELETE /api/invoices/[id] (Cancel draft invoice - should succeed)
echo -e "${YELLOW}Step 14: DELETE /api/invoices/$INVOICE_ID2 (Cancel draft invoice)...${NC}"
CANCEL_DRAFT=$(curl -s -X DELETE "$BASE_URL/api/invoices/$INVOICE_ID2" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$CANCEL_DRAFT"
echo ""

# Step 15: Test GET /api/invoices/[id] again (Verify cancellation)
echo -e "${YELLOW}Step 15: GET /api/invoices/$INVOICE_ID2 (Verify cancellation)...${NC}"
GET_CANCELLED=$(curl -s -X GET "$BASE_URL/api/invoices/$INVOICE_ID2" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$GET_CANCELLED"

CANCELLED_STATUS=$(echo "$GET_CANCELLED" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
if [ "$CANCELLED_STATUS" = "cancelled" ]; then
  echo -e "${GREEN}✅ Invoice cancelled successfully${NC}"
fi
echo ""

# Step 16: Test GET /api/invoices?overdue=true (Find overdue invoices)
echo -e "${YELLOW}Step 16: GET /api/invoices?overdue=true (Find overdue invoices)...${NC}"
OVERDUE_INVOICES=$(curl -s -X GET "$BASE_URL/api/invoices?overdue=true" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$OVERDUE_INVOICES"
echo ""

# Step 17: Test invoice number generation (create another invoice)
echo -e "${YELLOW}Step 17: POST /api/invoices (Test auto invoice number generation)...${NC}"
CREATE_INVOICE3=$(curl -s -X POST "$BASE_URL/api/invoices" \
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
    \"status\": \"draft\"
  }")

INVOICE_NUMBER3=$(echo "$CREATE_INVOICE3" | grep -o '"invoiceNumber":"[^"]*"' | cut -d'"' -f4)
echo "$CREATE_INVOICE3"

if [ -n "$INVOICE_NUMBER3" ]; then
  echo -e "${GREEN}✅ Auto-generated invoice number: $INVOICE_NUMBER3${NC}"
fi
echo ""

echo -e "${GREEN}=== All tests completed! ===${NC}"

# Cleanup
rm -f /tmp/bms_invoices_cookies.txt

































