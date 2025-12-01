#!/bin/bash

# Test script for Lease CRUD API endpoints
# Make sure the dev server is running: npm run dev

BASE_URL="http://localhost:3000"
SESSION_COOKIE="bms_session"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== BMS Lease API Test Script ===${NC}\n"

# Check if server is running
if ! curl -s "$BASE_URL/api/health" > /dev/null 2>&1; then
  echo -e "${RED}❌ Server is not running at $BASE_URL${NC}"
  echo -e "${YELLOW}Please start the dev server with: npm run dev${NC}"
  exit 1
fi

# Step 1: Login as ORG_ADMIN (assuming already seeded)
echo -e "${YELLOW}Step 1: Logging in as ORG_ADMIN...${NC}"
ORG_ADMIN_LOGIN=$(curl -s -c /tmp/bms_leases_cookies.txt -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"identifier": "admin@example.com", "password": "ChangeMe123!"}')

echo "$ORG_ADMIN_LOGIN"

ORG_ADMIN_SESSION=$(grep "$SESSION_COOKIE" /tmp/bms_leases_cookies.txt | awk '{print $7}')

if [ -z "$ORG_ADMIN_SESSION" ]; then
  echo -e "${RED}❌ Failed to get ORG_ADMIN session token${NC}"
  exit 1
fi

echo -e "${GREEN}✅ ORG_ADMIN session token obtained${NC}\n"

# Step 2: Get or create a building
echo -e "${YELLOW}Step 2: Getting or creating a building...${NC}"
LIST_BUILDINGS=$(curl -s -X GET "$BASE_URL/api/buildings?status=active" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")

BUILDING_ID=$(echo "$LIST_BUILDINGS" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$BUILDING_ID" ]; then
  echo -e "${YELLOW}No active building found, creating one...${NC}"
  CREATE_BUILDING=$(curl -s -X POST "$BASE_URL/api/buildings" \
    -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Test Building for Leases",
      "address": {
        "street": "Test Street",
        "city": "Addis Ababa"
      },
      "buildingType": "residential",
      "totalFloors": 3,
      "status": "active"
    }')
  
  BUILDING_ID=$(echo "$CREATE_BUILDING" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
fi

if [ -z "$BUILDING_ID" ]; then
  echo -e "${RED}❌ Failed to get or create building${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Building ID: $BUILDING_ID${NC}\n"

# Step 3: Get or create a unit
echo -e "${YELLOW}Step 3: Getting or creating a unit...${NC}"
LIST_UNITS=$(curl -s -X GET "$BASE_URL/api/units?buildingId=$BUILDING_ID&status=available" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")

UNIT_ID=$(echo "$LIST_UNITS" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$UNIT_ID" ]; then
  echo -e "${YELLOW}No available unit found, creating one...${NC}"
  CREATE_UNIT=$(curl -s -X POST "$BASE_URL/api/units" \
    -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
    -H "Content-Type: application/json" \
    -d "{
      \"buildingId\": \"$BUILDING_ID\",
      \"unitNumber\": \"L-101\",
      \"floor\": 1,
      \"unitType\": \"apartment\",
      \"area\": 100,
      \"bedrooms\": 2,
      \"bathrooms\": 1,
      \"status\": \"available\",
      \"rentAmount\": 15000
    }")
  
  UNIT_ID=$(echo "$CREATE_UNIT" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
fi

if [ -z "$UNIT_ID" ]; then
  echo -e "${RED}❌ Failed to get or create unit${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Unit ID: $UNIT_ID${NC}\n"

# Step 4: Get or create a tenant
echo -e "${YELLOW}Step 4: Getting or creating a tenant...${NC}"
LIST_TENANTS=$(curl -s -X GET "$BASE_URL/api/tenants?status=active" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")

TENANT_ID=$(echo "$LIST_TENANTS" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$TENANT_ID" ]; then
  echo -e "${YELLOW}No tenant found, creating one...${NC}"
  CREATE_TENANT=$(curl -s -X POST "$BASE_URL/api/tenants" \
    -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
    -H "Content-Type: application/json" \
    -d '{
      "firstName": "Lease",
      "lastName": "Test",
      "primaryPhone": "+251911111111",
      "email": "lease.test@example.com",
      "language": "en",
      "status": "active"
    }')
  
  TENANT_ID=$(echo "$CREATE_TENANT" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
fi

if [ -z "$TENANT_ID" ]; then
  echo -e "${RED}❌ Failed to get or create tenant${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Tenant ID: $TENANT_ID${NC}\n"

# Step 5: Test GET /api/leases (List leases - should be empty initially)
echo -e "${YELLOW}Step 5: GET /api/leases (List leases)...${NC}"
LIST_LEASES=$(curl -s -X GET "$BASE_URL/api/leases" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$LIST_LEASES"
echo ""

# Step 6: Test POST /api/leases (Create lease)
echo -e "${YELLOW}Step 6: POST /api/leases (Create lease)...${NC}"

# Calculate dates (start today, end in 12 months)
START_DATE=$(date -u +"%Y-%m-%dT00:00:00.000Z")
END_DATE=$(date -u -d "+12 months" +"%Y-%m-%dT00:00:00.000Z" 2>/dev/null || date -u -v+12m +"%Y-%m-%dT00:00:00.000Z" 2>/dev/null || echo "")

if [ -z "$END_DATE" ]; then
  # Fallback: use node to calculate date
  END_DATE=$(node -e "const d = new Date(); d.setMonth(d.getMonth() + 12); console.log(d.toISOString())" 2>/dev/null || echo "")
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
    \"depositAmount\": 30000,
    \"billingCycle\": \"monthly\",
    \"dueDay\": 5,
    \"additionalCharges\": [
      {
        \"name\": \"Maintenance Fee\",
        \"amount\": 500,
        \"frequency\": \"monthly\"
      }
    ],
    \"status\": \"active\"
  }")

echo "$CREATE_LEASE"

LEASE_ID=$(echo "$CREATE_LEASE" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -z "$LEASE_ID" ]; then
  echo -e "${RED}❌ Failed to create lease${NC}"
  echo -e "${YELLOW}Response: $CREATE_LEASE${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Lease created with ID: $LEASE_ID${NC}\n"

# Step 7: Verify unit status changed to occupied
echo -e "${YELLOW}Step 7: GET /api/units/$UNIT_ID (Verify unit status changed to occupied)...${NC}"
GET_UNIT=$(curl -s -X GET "$BASE_URL/api/units/$UNIT_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$GET_UNIT"

UNIT_STATUS=$(echo "$GET_UNIT" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
if [ "$UNIT_STATUS" = "occupied" ]; then
  echo -e "${GREEN}✅ Unit status correctly changed to occupied${NC}"
else
  echo -e "${YELLOW}⚠️  Unit status: $UNIT_STATUS (expected: occupied)${NC}"
fi
echo ""

# Step 8: Test GET /api/leases/[id] (Get single lease)
echo -e "${YELLOW}Step 8: GET /api/leases/$LEASE_ID (Get single lease)...${NC}"
GET_LEASE=$(curl -s -X GET "$BASE_URL/api/leases/$LEASE_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$GET_LEASE"
echo ""

# Step 9: Test GET /api/leases with filters
echo -e "${YELLOW}Step 9: GET /api/leases?tenantId=$TENANT_ID (Filter by tenant)...${NC}"
FILTER_BY_TENANT=$(curl -s -X GET "$BASE_URL/api/leases?tenantId=$TENANT_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$FILTER_BY_TENANT"
echo ""

echo -e "${YELLOW}Step 9b: GET /api/leases?unitId=$UNIT_ID (Filter by unit)...${NC}"
FILTER_BY_UNIT=$(curl -s -X GET "$BASE_URL/api/leases?unitId=$UNIT_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$FILTER_BY_UNIT"
echo ""

echo -e "${YELLOW}Step 9c: GET /api/leases?status=active (Filter by status)...${NC}"
FILTER_BY_STATUS=$(curl -s -X GET "$BASE_URL/api/leases?status=active" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$FILTER_BY_STATUS"
echo ""

# Step 10: Test error case - Try to create duplicate lease (should fail)
echo -e "${YELLOW}Step 10: POST /api/leases (Try to create duplicate lease - should fail)...${NC}"
DUPLICATE_LEASE=$(curl -s -X POST "$BASE_URL/api/leases" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d "{
    \"tenantId\": \"$TENANT_ID\",
    \"unitId\": \"$UNIT_ID\",
    \"startDate\": \"$START_DATE\",
    \"rentAmount\": 15000,
    \"billingCycle\": \"monthly\",
    \"dueDay\": 5
  }")
echo "$DUPLICATE_LEASE"
echo ""

# Step 11: Test PATCH /api/leases/[id] (Update lease)
echo -e "${YELLOW}Step 11: PATCH /api/leases/$LEASE_ID (Update lease)...${NC}"
UPDATE_LEASE=$(curl -s -X PATCH "$BASE_URL/api/leases/$LEASE_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d '{
    "rentAmount": 18000,
    "dueDay": 10
  }')
echo "$UPDATE_LEASE"
echo ""

# Step 12: Test GET /api/leases/[id] again (Verify update)
echo -e "${YELLOW}Step 12: GET /api/leases/$LEASE_ID (Verify update)...${NC}"
GET_UPDATED_LEASE=$(curl -s -X GET "$BASE_URL/api/leases/$LEASE_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$GET_UPDATED_LEASE"
echo ""

# Step 13: Test DELETE /api/leases/[id] (Terminate lease)
echo -e "${YELLOW}Step 13: DELETE /api/leases/$LEASE_ID (Terminate lease)...${NC}"
DELETE_LEASE=$(curl -s -X DELETE "$BASE_URL/api/leases/$LEASE_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Tenant moved out"}')
echo "$DELETE_LEASE"
echo ""

# Step 14: Verify unit status changed back to available
echo -e "${YELLOW}Step 14: GET /api/units/$UNIT_ID (Verify unit status changed back to available)...${NC}"
GET_UNIT_AFTER=$(curl -s -X GET "$BASE_URL/api/units/$UNIT_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$GET_UNIT_AFTER"

UNIT_STATUS_AFTER=$(echo "$GET_UNIT_AFTER" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
if [ "$UNIT_STATUS_AFTER" = "available" ]; then
  echo -e "${GREEN}✅ Unit status correctly changed back to available${NC}"
else
  echo -e "${YELLOW}⚠️  Unit status: $UNIT_STATUS_AFTER (expected: available)${NC}"
fi
echo ""

# Step 15: Test GET /api/leases/[id] again (Should show terminated status)
echo -e "${YELLOW}Step 15: GET /api/leases/$LEASE_ID (Verify termination)...${NC}"
GET_TERMINATED_LEASE=$(curl -s -X GET "$BASE_URL/api/leases/$LEASE_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$GET_TERMINATED_LEASE"

STATUS=$(echo "$GET_TERMINATED_LEASE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
if [ "$STATUS" = "terminated" ]; then
  echo -e "${GREEN}✅ Lease terminated successfully (status: terminated)${NC}"
else
  echo -e "${YELLOW}⚠️  Lease status: $STATUS (expected: terminated)${NC}"
fi
echo ""

echo -e "${GREEN}=== All tests completed! ===${NC}"

# Cleanup
rm -f /tmp/bms_leases_cookies.txt


































