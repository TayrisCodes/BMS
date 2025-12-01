#!/bin/bash

# Test script for Parking Spaces CRUD API endpoints
# Make sure the dev server is running: npm run dev

BASE_URL="http://localhost:3000"
SESSION_COOKIE="bms_session"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== BMS Parking Spaces API Test Script ===${NC}\n"

# Check if server is running
if ! curl -s "$BASE_URL/api/health" > /dev/null 2>&1; then
  echo -e "${RED}❌ Server is not running at $BASE_URL${NC}"
  echo -e "${YELLOW}Please start the dev server with: npm run dev${NC}"
  exit 1
fi

# Step 1: Login as ORG_ADMIN
echo -e "${YELLOW}Step 1: Logging in as ORG_ADMIN...${NC}"
ORG_ADMIN_LOGIN=$(curl -s -c /tmp/bms_parking_cookies.txt -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"identifier": "admin@example.com", "password": "ChangeMe123!"}')

echo "$ORG_ADMIN_LOGIN"

ORG_ADMIN_SESSION=$(grep "$SESSION_COOKIE" /tmp/bms_parking_cookies.txt | awk '{print $7}')

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
  CREATE_BUILDING=$(curl -s -X POST "$BASE_URL/api/buildings" \
    -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Test Building for Parking",
      "address": {
        "street": "Test Street",
        "city": "Addis Ababa",
        "region": "Addis Ababa"
      },
      "buildingType": "residential",
      "totalFloors": 3,
      "totalUnits": 10,
      "status": "active"
    }')
  BUILDING_ID=$(echo "$CREATE_BUILDING" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
fi

if [ -z "$BUILDING_ID" ]; then
  echo -e "${RED}❌ Failed to get or create building${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Building ID: $BUILDING_ID${NC}\n"

# Step 3: Ensure indexes (using SUPER_ADMIN session)
echo -e "${YELLOW}Step 3: Ensuring database indexes...${NC}"
SUPER_ADMIN_LOGIN=$(curl -s -c /tmp/bms_parking_super_cookies.txt -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"identifier": "superadmin@bms.local", "password": "SuperAdmin123!"}')

SUPER_ADMIN_SESSION=$(grep "$SESSION_COOKIE" /tmp/bms_parking_super_cookies.txt | awk '{print $7}')

if [ ! -z "$SUPER_ADMIN_SESSION" ]; then
  ENSURE_INDEXES=$(curl -s -X POST "$BASE_URL/api/admin/ensure-indexes" \
    -b "$SESSION_COOKIE=$SUPER_ADMIN_SESSION" \
    -H "Content-Type: application/json")
  echo "$ENSURE_INDEXES"
  echo ""
fi

# Step 4: Test GET /api/parking-spaces (List parking spaces - should be empty initially)
echo -e "${YELLOW}Step 4: GET /api/parking-spaces (List parking spaces)...${NC}"
LIST_SPACES=$(curl -s -X GET "$BASE_URL/api/parking-spaces" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$LIST_SPACES"
echo ""

# Step 5: Test POST /api/parking-spaces (Create tenant parking space)
echo -e "${YELLOW}Step 5: POST /api/parking-spaces (Create tenant parking space)...${NC}"

CREATE_SPACE=$(curl -s -X POST "$BASE_URL/api/parking-spaces" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d "{
    \"buildingId\": \"$BUILDING_ID\",
    \"spaceNumber\": \"P-001\",
    \"spaceType\": \"tenant\",
    \"status\": \"available\",
    \"notes\": \"Test tenant parking space\"
  }")

echo "$CREATE_SPACE"

SPACE_ID=$(echo "$CREATE_SPACE" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$SPACE_ID" ]; then
  echo -e "${RED}❌ Failed to create parking space${NC}"
  echo -e "${YELLOW}Response: $CREATE_SPACE${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Parking space created with ID: $SPACE_ID${NC}\n"

# Step 6: Test GET /api/parking-spaces/[id] (Get single parking space)
echo -e "${YELLOW}Step 6: GET /api/parking-spaces/$SPACE_ID (Get single parking space)...${NC}"
GET_SPACE=$(curl -s -X GET "$BASE_URL/api/parking-spaces/$SPACE_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$GET_SPACE"
echo ""

# Step 7: Test GET /api/parking-spaces with filters
echo -e "${YELLOW}Step 7: GET /api/parking-spaces?buildingId=$BUILDING_ID (Filter by building)...${NC}"
FILTER_BY_BUILDING=$(curl -s -X GET "$BASE_URL/api/parking-spaces?buildingId=$BUILDING_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$FILTER_BY_BUILDING"
echo ""

echo -e "${YELLOW}Step 7b: GET /api/parking-spaces?spaceType=tenant (Filter by space type)...${NC}"
FILTER_BY_TYPE=$(curl -s -X GET "$BASE_URL/api/parking-spaces?spaceType=tenant" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$FILTER_BY_TYPE"
echo ""

echo -e "${YELLOW}Step 7c: GET /api/parking-spaces?status=available (Filter by status)...${NC}"
FILTER_BY_STATUS=$(curl -s -X GET "$BASE_URL/api/parking-spaces?status=available" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$FILTER_BY_STATUS"
echo ""

# Step 8: Test PATCH /api/parking-spaces/[id] (Update parking space)
echo -e "${YELLOW}Step 8: PATCH /api/parking-spaces/$SPACE_ID (Update parking space)...${NC}"
UPDATE_SPACE=$(curl -s -X PATCH "$BASE_URL/api/parking-spaces/$SPACE_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "occupied",
    "notes": "Updated parking space"
  }')
echo "$UPDATE_SPACE"
echo ""

# Step 9: Test GET /api/parking-spaces/[id] again (Verify update)
echo -e "${YELLOW}Step 9: GET /api/parking-spaces/$SPACE_ID (Verify update)...${NC}"
GET_UPDATED=$(curl -s -X GET "$BASE_URL/api/parking-spaces/$SPACE_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$GET_UPDATED"
echo ""

UPDATED_STATUS=$(echo "$GET_UPDATED" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
if [ "$UPDATED_STATUS" = "occupied" ]; then
  echo -e "${GREEN}✅ Parking space status updated to occupied${NC}"
fi
echo ""

# Step 10: Create another parking space (visitor space)
echo -e "${YELLOW}Step 10: POST /api/parking-spaces (Create visitor parking space)...${NC}"
CREATE_VISITOR_SPACE=$(curl -s -X POST "$BASE_URL/api/parking-spaces" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d "{
    \"buildingId\": \"$BUILDING_ID\",
    \"spaceNumber\": \"P-002\",
    \"spaceType\": \"visitor\",
    \"status\": \"available\",
    \"notes\": \"Test visitor parking space\"
  }")

VISITOR_SPACE_ID=$(echo "$CREATE_VISITOR_SPACE" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "$CREATE_VISITOR_SPACE"
echo ""

# Step 11: Create a reserved parking space
echo -e "${YELLOW}Step 11: POST /api/parking-spaces (Create reserved parking space)...${NC}"
CREATE_RESERVED_SPACE=$(curl -s -X POST "$BASE_URL/api/parking-spaces" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d "{
    \"buildingId\": \"$BUILDING_ID\",
    \"spaceNumber\": \"P-003\",
    \"spaceType\": \"reserved\",
    \"status\": \"reserved\",
    \"notes\": \"Test reserved parking space\"
  }")

RESERVED_SPACE_ID=$(echo "$CREATE_RESERVED_SPACE" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "$CREATE_RESERVED_SPACE"
echo ""

# Step 12: Test GET /api/parking-spaces?spaceType=visitor (Filter by visitor type)
echo -e "${YELLOW}Step 12: GET /api/parking-spaces?spaceType=visitor (Filter by visitor type)...${NC}"
FILTER_BY_VISITOR=$(curl -s -X GET "$BASE_URL/api/parking-spaces?spaceType=visitor" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$FILTER_BY_VISITOR"
echo ""

# Step 13: Test PATCH /api/parking-spaces/[id] (Update space to maintenance)
echo -e "${YELLOW}Step 13: PATCH /api/parking-spaces/$VISITOR_SPACE_ID (Update space to maintenance)...${NC}"
UPDATE_TO_MAINTENANCE=$(curl -s -X PATCH "$BASE_URL/api/parking-spaces/$VISITOR_SPACE_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "maintenance",
    "notes": "Space under maintenance"
  }')
echo "$UPDATE_TO_MAINTENANCE"
echo ""

# Step 14: Test DELETE /api/parking-spaces/[id] (Delete parking space)
echo -e "${YELLOW}Step 14: DELETE /api/parking-spaces/$RESERVED_SPACE_ID (Delete parking space)...${NC}"
DELETE_SPACE=$(curl -s -X DELETE "$BASE_URL/api/parking-spaces/$RESERVED_SPACE_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$DELETE_SPACE"
echo ""

# Step 15: Test GET /api/parking-spaces/[id] again (Verify deletion)
echo -e "${YELLOW}Step 15: GET /api/parking-spaces/$RESERVED_SPACE_ID (Verify deletion)...${NC}"
GET_DELETED=$(curl -s -X GET "$BASE_URL/api/parking-spaces/$RESERVED_SPACE_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$GET_DELETED"
echo ""

# Step 16: Test GET /api/parking-spaces (List all parking spaces)
echo -e "${YELLOW}Step 16: GET /api/parking-spaces (List all parking spaces)...${NC}"
LIST_ALL=$(curl -s -X GET "$BASE_URL/api/parking-spaces" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$LIST_ALL"
echo ""

echo -e "${GREEN}=== All parking spaces API tests completed! ===${NC}"

# Cleanup
rm -f /tmp/bms_parking_cookies.txt
rm -f /tmp/bms_parking_super_cookies.txt



















