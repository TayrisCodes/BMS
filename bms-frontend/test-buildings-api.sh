#!/bin/bash

# Test script for Building CRUD API endpoints
# Make sure the dev server is running: npm run dev

BASE_URL="http://localhost:3000"
SESSION_COOKIE="bms_session"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== BMS Building API Test Script ===${NC}\n"

# Check if server is running
if ! curl -s "$BASE_URL/api/health" > /dev/null 2>&1; then
  echo -e "${RED}❌ Server is not running at $BASE_URL${NC}"
  echo -e "${YELLOW}Please start the dev server with: npm run dev${NC}"
  exit 1
fi

# Step 1: Login as ORG_ADMIN (assuming already seeded)
echo -e "${YELLOW}Step 1: Logging in as ORG_ADMIN...${NC}"
ORG_ADMIN_LOGIN=$(curl -s -c /tmp/bms_buildings_cookies.txt -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"identifier": "admin@example.com", "password": "ChangeMe123!"}')

echo "$ORG_ADMIN_LOGIN"

ORG_ADMIN_SESSION=$(grep "$SESSION_COOKIE" /tmp/bms_buildings_cookies.txt | awk '{print $7}')

if [ -z "$ORG_ADMIN_SESSION" ]; then
  echo -e "${RED}❌ Failed to get ORG_ADMIN session token${NC}"
  exit 1
fi

echo -e "${GREEN}✅ ORG_ADMIN session token obtained${NC}\n"

# Step 2: Test GET /api/buildings (List buildings - should be empty initially)
echo -e "${YELLOW}Step 2: GET /api/buildings (List buildings)...${NC}"
LIST_BUILDINGS=$(curl -s -X GET "$BASE_URL/api/buildings" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$LIST_BUILDINGS"
echo ""

# Step 3: Test POST /api/buildings (Create building)
echo -e "${YELLOW}Step 3: POST /api/buildings (Create building)...${NC}"
CREATE_BUILDING=$(curl -s -X POST "$BASE_URL/api/buildings" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sunset Apartments",
    "address": {
      "street": "Bole Road",
      "city": "Addis Ababa",
      "region": "Addis Ababa",
      "postalCode": "1000"
    },
    "buildingType": "residential",
    "totalFloors": 5,
    "totalUnits": 20,
    "status": "active",
    "settings": {
      "parkingSpaces": 15,
      "amenities": ["Elevator", "Security", "Parking"]
    }
  }')

echo "$CREATE_BUILDING"

BUILDING_ID=$(echo "$CREATE_BUILDING" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -z "$BUILDING_ID" ]; then
  echo -e "${RED}❌ Failed to create building${NC}"
  echo -e "${YELLOW}Response: $CREATE_BUILDING${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Building created with ID: $BUILDING_ID${NC}\n"

# Step 4: Test GET /api/buildings/[id] (Get single building)
echo -e "${YELLOW}Step 4: GET /api/buildings/$BUILDING_ID (Get single building)...${NC}"
GET_BUILDING=$(curl -s -X GET "$BASE_URL/api/buildings/$BUILDING_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$GET_BUILDING"
echo ""

# Step 5: Test GET /api/buildings with search
echo -e "${YELLOW}Step 5: GET /api/buildings?search=Sunset (Search buildings)...${NC}"
SEARCH_BUILDINGS=$(curl -s -X GET "$BASE_URL/api/buildings?search=Sunset" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$SEARCH_BUILDINGS"
echo ""

# Step 6: Test GET /api/buildings with filter by type
echo -e "${YELLOW}Step 6: GET /api/buildings?buildingType=residential (Filter by type)...${NC}"
FILTER_BUILDINGS=$(curl -s -X GET "$BASE_URL/api/buildings?buildingType=residential" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$FILTER_BUILDINGS"
echo ""

# Step 7: Test PATCH /api/buildings/[id] (Update building)
echo -e "${YELLOW}Step 7: PATCH /api/buildings/$BUILDING_ID (Update building)...${NC}"
UPDATE_BUILDING=$(curl -s -X PATCH "$BASE_URL/api/buildings/$BUILDING_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sunset Apartments Updated",
    "totalUnits": 25,
    "settings": {
      "parkingSpaces": 20,
      "amenities": ["Elevator", "Security", "Parking", "Gym"]
    }
  }')
echo "$UPDATE_BUILDING"
echo ""

# Step 8: Test GET /api/buildings/[id] again (Verify update)
echo -e "${YELLOW}Step 8: GET /api/buildings/$BUILDING_ID (Verify update)...${NC}"
GET_UPDATED_BUILDING=$(curl -s -X GET "$BASE_URL/api/buildings/$BUILDING_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$GET_UPDATED_BUILDING"
echo ""

# Step 9: Test DELETE /api/buildings/[id] (Soft delete)
echo -e "${YELLOW}Step 9: DELETE /api/buildings/$BUILDING_ID (Soft delete building)...${NC}"
DELETE_BUILDING=$(curl -s -X DELETE "$BASE_URL/api/buildings/$BUILDING_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$DELETE_BUILDING"
echo ""

# Step 10: Test GET /api/buildings/[id] again (Should still exist but with inactive status)
echo -e "${YELLOW}Step 10: GET /api/buildings/$BUILDING_ID (Verify soft delete)...${NC}"
GET_DELETED_BUILDING=$(curl -s -X GET "$BASE_URL/api/buildings/$BUILDING_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$GET_DELETED_BUILDING"

STATUS=$(echo "$GET_DELETED_BUILDING" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
if [ "$STATUS" = "inactive" ]; then
  echo -e "${GREEN}✅ Building soft deleted successfully (status: inactive)${NC}"
else
  echo -e "${YELLOW}⚠️  Building status: $STATUS (expected: inactive)${NC}"
fi
echo ""

# Step 11: Test GET /api/buildings?status=active (Filter by status)
echo -e "${YELLOW}Step 11: GET /api/buildings?status=active (Filter by status)...${NC}"
FILTER_ACTIVE_BUILDINGS=$(curl -s -X GET "$BASE_URL/api/buildings?status=active" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$FILTER_ACTIVE_BUILDINGS"
echo ""

# Step 12: Create another building with different type
echo -e "${YELLOW}Step 12: POST /api/buildings (Create commercial building)...${NC}"
CREATE_COMMERCIAL=$(curl -s -X POST "$BASE_URL/api/buildings" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Bole Shopping Center",
    "address": {
      "street": "Bole Road",
      "city": "Addis Ababa",
      "region": "Addis Ababa"
    },
    "buildingType": "commercial",
    "totalFloors": 3,
    "totalUnits": 30,
    "status": "active"
  }')
echo "$CREATE_COMMERCIAL"
echo ""

echo -e "${GREEN}=== All tests completed! ===${NC}"

# Cleanup
rm -f /tmp/bms_buildings_cookies.txt


































