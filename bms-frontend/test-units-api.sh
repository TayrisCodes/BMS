#!/bin/bash

# Test script for Unit CRUD API endpoints
# Make sure the dev server is running: npm run dev

BASE_URL="http://localhost:3000"
SESSION_COOKIE="bms_session"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== BMS Unit API Test Script ===${NC}\n"

# Check if server is running
if ! curl -s "$BASE_URL/api/health" > /dev/null 2>&1; then
  echo -e "${RED}❌ Server is not running at $BASE_URL${NC}"
  echo -e "${YELLOW}Please start the dev server with: npm run dev${NC}"
  exit 1
fi

# Step 1: Login as ORG_ADMIN (assuming already seeded)
echo -e "${YELLOW}Step 1: Logging in as ORG_ADMIN...${NC}"
ORG_ADMIN_LOGIN=$(curl -s -c /tmp/bms_units_cookies.txt -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"identifier": "admin@example.com", "password": "ChangeMe123!"}')

echo "$ORG_ADMIN_LOGIN"

ORG_ADMIN_SESSION=$(grep "$SESSION_COOKIE" /tmp/bms_units_cookies.txt | awk '{print $7}')

if [ -z "$ORG_ADMIN_SESSION" ]; then
  echo -e "${RED}❌ Failed to get ORG_ADMIN session token${NC}"
  exit 1
fi

echo -e "${GREEN}✅ ORG_ADMIN session token obtained${NC}\n"

# Step 2: Get or create a building for testing
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
      "name": "Test Building for Units",
      "address": {
        "street": "Test Street",
        "city": "Addis Ababa",
        "region": "Addis Ababa"
      },
      "buildingType": "residential",
      "totalFloors": 3,
      "status": "active"
    }')
  
  BUILDING_ID=$(echo "$CREATE_BUILDING" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
  echo "$CREATE_BUILDING"
fi

if [ -z "$BUILDING_ID" ]; then
  echo -e "${RED}❌ Failed to get or create building${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Building ID: $BUILDING_ID${NC}\n"

# Step 3: Test GET /api/units (List units - should be empty initially)
echo -e "${YELLOW}Step 3: GET /api/units (List units)...${NC}"
LIST_UNITS=$(curl -s -X GET "$BASE_URL/api/units" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$LIST_UNITS"
echo ""

# Step 4: Test POST /api/units (Create unit)
echo -e "${YELLOW}Step 4: POST /api/units (Create unit)...${NC}"
CREATE_UNIT=$(curl -s -X POST "$BASE_URL/api/units" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d "{
    \"buildingId\": \"$BUILDING_ID\",
    \"unitNumber\": \"A-101\",
    \"floor\": 1,
    \"unitType\": \"apartment\",
    \"area\": 85.5,
    \"bedrooms\": 2,
    \"bathrooms\": 1,
    \"status\": \"available\",
    \"rentAmount\": 15000
  }")

echo "$CREATE_UNIT"

UNIT_ID=$(echo "$CREATE_UNIT" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -z "$UNIT_ID" ]; then
  echo -e "${RED}❌ Failed to create unit${NC}"
  echo -e "${YELLOW}Response: $CREATE_UNIT${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Unit created with ID: $UNIT_ID${NC}\n"

# Step 5: Test GET /api/units/[id] (Get single unit)
echo -e "${YELLOW}Step 5: GET /api/units/$UNIT_ID (Get single unit)...${NC}"
GET_UNIT=$(curl -s -X GET "$BASE_URL/api/units/$UNIT_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$GET_UNIT"
echo ""

# Step 6: Test GET /api/units with buildingId filter
echo -e "${YELLOW}Step 6: GET /api/units?buildingId=$BUILDING_ID (Filter by building)...${NC}"
FILTER_BY_BUILDING=$(curl -s -X GET "$BASE_URL/api/units?buildingId=$BUILDING_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$FILTER_BY_BUILDING"
echo ""

# Step 7: Test GET /api/units with status filter
echo -e "${YELLOW}Step 7: GET /api/units?status=available (Filter by status)...${NC}"
FILTER_BY_STATUS=$(curl -s -X GET "$BASE_URL/api/units?status=available" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$FILTER_BY_STATUS"
echo ""

# Step 8: Test GET /api/units with unitType filter
echo -e "${YELLOW}Step 8: GET /api/units?unitType=apartment (Filter by type)...${NC}"
FILTER_BY_TYPE=$(curl -s -X GET "$BASE_URL/api/units?unitType=apartment" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$FILTER_BY_TYPE"
echo ""

# Step 9: Test GET /api/units with search
echo -e "${YELLOW}Step 9: GET /api/units?search=A-101 (Search by unit number)...${NC}"
SEARCH_UNITS=$(curl -s -X GET "$BASE_URL/api/units?search=A-101" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$SEARCH_UNITS"
echo ""

# Step 10: Test PATCH /api/units/[id] (Update unit)
echo -e "${YELLOW}Step 10: PATCH /api/units/$UNIT_ID (Update unit)...${NC}"
UPDATE_UNIT=$(curl -s -X PATCH "$BASE_URL/api/units/$UNIT_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d '{
    "unitNumber": "A-101-Updated",
    "rentAmount": 18000,
    "bedrooms": 3
  }')
echo "$UPDATE_UNIT"
echo ""

# Step 11: Test GET /api/units/[id] again (Verify update)
echo -e "${YELLOW}Step 11: GET /api/units/$UNIT_ID (Verify update)...${NC}"
GET_UPDATED_UNIT=$(curl -s -X GET "$BASE_URL/api/units/$UNIT_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$GET_UPDATED_UNIT"
echo ""

# Step 12: Test error case - Create unit with duplicate unit number
echo -e "${YELLOW}Step 12: POST /api/units (Try to create duplicate unit number - should fail)...${NC}"
DUPLICATE_UNIT=$(curl -s -X POST "$BASE_URL/api/units" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d "{
    \"buildingId\": \"$BUILDING_ID\",
    \"unitNumber\": \"A-101-Updated\",
    \"unitType\": \"apartment\"
  }")
echo "$DUPLICATE_UNIT"
echo ""

# Step 13: Create another unit with different unit number
echo -e "${YELLOW}Step 13: POST /api/units (Create second unit)...${NC}"
CREATE_UNIT2=$(curl -s -X POST "$BASE_URL/api/units" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d "{
    \"buildingId\": \"$BUILDING_ID\",
    \"unitNumber\": \"A-102\",
    \"floor\": 1,
    \"unitType\": \"apartment\",
    \"area\": 95.0,
    \"bedrooms\": 3,
    \"bathrooms\": 2,
    \"status\": \"available\",
    \"rentAmount\": 20000
  }")
echo "$CREATE_UNIT2"
echo ""

# Step 14: Test DELETE /api/units/[id] (Soft delete)
echo -e "${YELLOW}Step 14: DELETE /api/units/$UNIT_ID (Soft delete unit)...${NC}"
DELETE_UNIT=$(curl -s -X DELETE "$BASE_URL/api/units/$UNIT_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$DELETE_UNIT"
echo ""

# Step 15: Test GET /api/units/[id] again (Should still exist but with maintenance status)
echo -e "${YELLOW}Step 15: GET /api/units/$UNIT_ID (Verify soft delete)...${NC}"
GET_DELETED_UNIT=$(curl -s -X GET "$BASE_URL/api/units/$UNIT_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$GET_DELETED_UNIT"

STATUS=$(echo "$GET_DELETED_UNIT" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
if [ "$STATUS" = "maintenance" ]; then
  echo -e "${GREEN}✅ Unit soft deleted successfully (status: maintenance)${NC}"
else
  echo -e "${YELLOW}⚠️  Unit status: $STATUS (expected: maintenance)${NC}"
fi
echo ""

echo -e "${GREEN}=== All tests completed! ===${NC}"

# Cleanup
rm -f /tmp/bms_units_cookies.txt

































