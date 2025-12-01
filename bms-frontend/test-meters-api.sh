#!/bin/bash

# Test script for Meters CRUD API endpoints
# Make sure the dev server is running: npm run dev

BASE_URL="http://localhost:3000"
SESSION_COOKIE="bms_session"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== BMS Meters API Test Script ===${NC}\n"

# Check if server is running
if ! curl -s "$BASE_URL/api/health" > /dev/null 2>&1; then
  echo -e "${RED}❌ Server is not running at $BASE_URL${NC}"
  echo -e "${YELLOW}Please start the dev server with: npm run dev${NC}"
  exit 1
fi

# Step 1: Login as ORG_ADMIN
echo -e "${YELLOW}Step 1: Logging in as ORG_ADMIN...${NC}"
ORG_ADMIN_LOGIN=$(curl -s -c /tmp/bms_meters_cookies.txt -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"identifier": "admin@example.com", "password": "ChangeMe123!"}')

echo "$ORG_ADMIN_LOGIN"

ORG_ADMIN_SESSION=$(grep "$SESSION_COOKIE" /tmp/bms_meters_cookies.txt | awk '{print $7}')

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
      "name": "Test Building for Meters",
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

# Step 3: Get or create a unit (optional, for unit-level meter)
echo -e "${YELLOW}Step 3: Getting or creating a unit (optional)...${NC}"

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
      \"unitNumber\": \"A-101\",
      \"unitType\": \"apartment\",
      \"floor\": 1,
      \"area\": 50,
      \"bedrooms\": 2,
      \"bathrooms\": 1,
      \"status\": \"available\",
      \"rentAmount\": 5000
    }")
  UNIT_ID=$(echo "$CREATE_UNIT" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
fi

echo -e "${GREEN}✅ Unit ID: $UNIT_ID${NC}\n"

# Step 4: Ensure indexes (using SUPER_ADMIN session)
echo -e "${YELLOW}Step 4: Ensuring database indexes...${NC}"
SUPER_ADMIN_LOGIN=$(curl -s -c /tmp/bms_meters_super_cookies.txt -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"identifier": "superadmin@bms.local", "password": "SuperAdmin123!"}')

SUPER_ADMIN_SESSION=$(grep "$SESSION_COOKIE" /tmp/bms_meters_super_cookies.txt | awk '{print $7}')

if [ ! -z "$SUPER_ADMIN_SESSION" ]; then
  ENSURE_INDEXES=$(curl -s -X POST "$BASE_URL/api/admin/ensure-indexes" \
    -b "$SESSION_COOKIE=$SUPER_ADMIN_SESSION" \
    -H "Content-Type: application/json")
  echo "$ENSURE_INDEXES"
  echo ""
fi

# Step 5: Test GET /api/meters (List meters - should be empty initially)
echo -e "${YELLOW}Step 5: GET /api/meters (List meters)...${NC}"
LIST_METERS=$(curl -s -X GET "$BASE_URL/api/meters" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$LIST_METERS"
echo ""

# Step 6: Test POST /api/meters (Create electricity meter)
echo -e "${YELLOW}Step 6: POST /api/meters (Create electricity meter)...${NC}"

INSTALLATION_DATE=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

CREATE_METER=$(curl -s -X POST "$BASE_URL/api/meters" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d "{
    \"buildingId\": \"$BUILDING_ID\",
    \"meterType\": \"electricity\",
    \"meterNumber\": \"ELEC-001\",
    \"unit\": \"kwh\",
    \"installationDate\": \"$INSTALLATION_DATE\",
    \"status\": \"active\",
    \"lastReading\": 1000,
    \"lastReadingDate\": \"$INSTALLATION_DATE\"
  }")

echo "$CREATE_METER"

METER_ID=$(echo "$CREATE_METER" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$METER_ID" ]; then
  echo -e "${RED}❌ Failed to create meter${NC}"
  echo -e "${YELLOW}Response: $CREATE_METER${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Meter created with ID: $METER_ID${NC}\n"

# Step 7: Test GET /api/meters/[id] (Get single meter)
echo -e "${YELLOW}Step 7: GET /api/meters/$METER_ID (Get single meter)...${NC}"
GET_METER=$(curl -s -X GET "$BASE_URL/api/meters/$METER_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$GET_METER"
echo ""

# Step 8: Test GET /api/meters with filters
echo -e "${YELLOW}Step 8: GET /api/meters?buildingId=$BUILDING_ID (Filter by building)...${NC}"
FILTER_BY_BUILDING=$(curl -s -X GET "$BASE_URL/api/meters?buildingId=$BUILDING_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$FILTER_BY_BUILDING"
echo ""

echo -e "${YELLOW}Step 8b: GET /api/meters?meterType=electricity (Filter by meter type)...${NC}"
FILTER_BY_TYPE=$(curl -s -X GET "$BASE_URL/api/meters?meterType=electricity" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$FILTER_BY_TYPE"
echo ""

echo -e "${YELLOW}Step 8c: GET /api/meters?status=active (Filter by status)...${NC}"
FILTER_BY_STATUS=$(curl -s -X GET "$BASE_URL/api/meters?status=active" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$FILTER_BY_STATUS"
echo ""

# Step 9: Test PATCH /api/meters/[id] (Update meter)
echo -e "${YELLOW}Step 9: PATCH /api/meters/$METER_ID (Update meter)...${NC}"
UPDATE_METER=$(curl -s -X PATCH "$BASE_URL/api/meters/$METER_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d '{
    "lastReading": 1500,
    "lastReadingDate": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'",
    "status": "active"
  }')
echo "$UPDATE_METER"
echo ""

# Step 10: Test GET /api/meters/[id] again (Verify update)
echo -e "${YELLOW}Step 10: GET /api/meters/$METER_ID (Verify update)...${NC}"
GET_UPDATED=$(curl -s -X GET "$BASE_URL/api/meters/$METER_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$GET_UPDATED"

LAST_READING=$(echo "$GET_UPDATED" | grep -o '"lastReading":[0-9]*' | cut -d':' -f2)
if [ "$LAST_READING" = "1500" ]; then
  echo -e "${GREEN}✅ Meter last reading updated to 1500${NC}"
fi
echo ""

# Step 11: Create another meter (water meter for unit)
echo -e "${YELLOW}Step 11: POST /api/meters (Create water meter for unit)...${NC}"

if [ ! -z "$UNIT_ID" ]; then
  CREATE_WATER_METER=$(curl -s -X POST "$BASE_URL/api/meters" \
    -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
    -H "Content-Type: application/json" \
    -d "{
      \"buildingId\": \"$BUILDING_ID\",
      \"unitId\": \"$UNIT_ID\",
      \"meterType\": \"water\",
      \"meterNumber\": \"WATER-001\",
      \"unit\": \"cubic_meter\",
      \"installationDate\": \"$INSTALLATION_DATE\",
      \"status\": \"active\",
      \"lastReading\": 50,
      \"lastReadingDate\": \"$INSTALLATION_DATE\"
    }")

  WATER_METER_ID=$(echo "$CREATE_WATER_METER" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
  echo "$CREATE_WATER_METER"
  echo ""

  # Step 12: Test GET /api/meters?unitId=... (Filter by unit)
  echo -e "${YELLOW}Step 12: GET /api/meters?unitId=$UNIT_ID (Filter by unit)...${NC}"
  FILTER_BY_UNIT=$(curl -s -X GET "$BASE_URL/api/meters?unitId=$UNIT_ID" \
    -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
    -H "Content-Type: application/json")
  echo "$FILTER_BY_UNIT"
  echo ""
fi

# Step 13: Create a gas meter (building-level)
echo -e "${YELLOW}Step 13: POST /api/meters (Create gas meter)...${NC}"
CREATE_GAS_METER=$(curl -s -X POST "$BASE_URL/api/meters" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d "{
    \"buildingId\": \"$BUILDING_ID\",
    \"meterType\": \"gas\",
    \"meterNumber\": \"GAS-001\",
    \"unit\": \"cubic_meter\",
    \"installationDate\": \"$INSTALLATION_DATE\",
    \"status\": \"active\"
  }")

GAS_METER_ID=$(echo "$CREATE_GAS_METER" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "$CREATE_GAS_METER"
echo ""

# Step 14: Test PATCH /api/meters/[id] (Update meter details)
echo -e "${YELLOW}Step 14: PATCH /api/meters/$GAS_METER_ID (Update meter details)...${NC}"
UPDATE_GAS_METER=$(curl -s -X PATCH "$BASE_URL/api/meters/$GAS_METER_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d '{
    "lastReading": 200,
    "lastReadingDate": "'$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")'",
    "status": "active"
  }')
echo "$UPDATE_GAS_METER"
echo ""

# Step 15: Test DELETE /api/meters/[id] (Soft delete meter)
echo -e "${YELLOW}Step 15: DELETE /api/meters/$GAS_METER_ID (Soft delete meter)...${NC}"
DELETE_METER=$(curl -s -X DELETE "$BASE_URL/api/meters/$GAS_METER_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$DELETE_METER"
echo ""

# Step 16: Test GET /api/meters/[id] again (Verify soft delete)
echo -e "${YELLOW}Step 16: GET /api/meters/$GAS_METER_ID (Verify soft delete)...${NC}"
GET_DELETED=$(curl -s -X GET "$BASE_URL/api/meters/$GAS_METER_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$GET_DELETED"

DELETED_STATUS=$(echo "$GET_DELETED" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
if [ "$DELETED_STATUS" = "inactive" ]; then
  echo -e "${GREEN}✅ Meter soft deleted successfully (status set to inactive)${NC}"
fi
echo ""

# Step 17: Test GET /api/meters (List all meters)
echo -e "${YELLOW}Step 17: GET /api/meters (List all meters)...${NC}"
LIST_ALL=$(curl -s -X GET "$BASE_URL/api/meters" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$LIST_ALL"
echo ""

echo -e "${GREEN}=== All meters API tests completed! ===${NC}"

# Cleanup
rm -f /tmp/bms_meters_cookies.txt
rm -f /tmp/bms_meters_super_cookies.txt



















