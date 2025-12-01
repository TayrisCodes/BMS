#!/bin/bash

# Test script for Meter Readings CRUD API endpoints
# Make sure the dev server is running: npm run dev

BASE_URL="http://localhost:3000"
SESSION_COOKIE="bms_session"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== BMS Meter Readings API Test Script ===${NC}\n"

# Check if server is running
if ! curl -s "$BASE_URL/api/health" > /dev/null 2>&1; then
  echo -e "${RED}❌ Server is not running at $BASE_URL${NC}"
  echo -e "${YELLOW}Please start the dev server with: npm run dev${NC}"
  exit 1
fi

# Step 1: Login as ORG_ADMIN
echo -e "${YELLOW}Step 1: Logging in as ORG_ADMIN...${NC}"
ORG_ADMIN_LOGIN=$(curl -s -c /tmp/bms_meter_readings_cookies.txt -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"identifier": "admin@example.com", "password": "ChangeMe123!"}')

echo "$ORG_ADMIN_LOGIN"

ORG_ADMIN_SESSION=$(grep "$SESSION_COOKIE" /tmp/bms_meter_readings_cookies.txt | awk '{print $7}')

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
      "name": "Test Building for Meter Readings",
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

# Step 3: Create a new meter specifically for meter readings tests
echo -e "${YELLOW}Step 3: Creating a new meter for meter readings tests...${NC}"

INSTALLATION_DATE=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")
TIMESTAMP=$(date +%s)

CREATE_METER=$(curl -s -X POST "$BASE_URL/api/meters" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d "{
    \"buildingId\": \"$BUILDING_ID\",
    \"meterType\": \"electricity\",
    \"meterNumber\": \"ELEC-READINGS-TEST-$TIMESTAMP\",
    \"unit\": \"kwh\",
    \"installationDate\": \"$INSTALLATION_DATE\",
    \"status\": \"active\"
  }")

METER_ID=$(echo "$CREATE_METER" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$METER_ID" ]; then
  echo -e "${RED}❌ Failed to create meter${NC}"
  echo -e "${YELLOW}Response: $CREATE_METER${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Meter ID: $METER_ID${NC}\n"

# Step 4: Ensure indexes (using SUPER_ADMIN session)
echo -e "${YELLOW}Step 4: Ensuring database indexes...${NC}"
SUPER_ADMIN_LOGIN=$(curl -s -c /tmp/bms_meter_readings_super_cookies.txt -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"identifier": "superadmin@bms.local", "password": "SuperAdmin123!"}')

SUPER_ADMIN_SESSION=$(grep "$SESSION_COOKIE" /tmp/bms_meter_readings_super_cookies.txt | awk '{print $7}')

if [ ! -z "$SUPER_ADMIN_SESSION" ]; then
  ENSURE_INDEXES=$(curl -s -X POST "$BASE_URL/api/admin/ensure-indexes" \
    -b "$SESSION_COOKIE=$SUPER_ADMIN_SESSION" \
    -H "Content-Type: application/json")
  echo "$ENSURE_INDEXES"
  echo ""
fi

# Step 5: Test GET /api/meter-readings (List readings - should be empty initially)
echo -e "${YELLOW}Step 5: GET /api/meter-readings (List readings)...${NC}"
LIST_READINGS=$(curl -s -X GET "$BASE_URL/api/meter-readings" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$LIST_READINGS"
echo ""

# Step 6: Test POST /api/meter-readings (Create first reading)
echo -e "${YELLOW}Step 6: POST /api/meter-readings (Create first reading)...${NC}"

READING_DATE1=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

CREATE_READING1=$(curl -s -X POST "$BASE_URL/api/meter-readings" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d "{
    \"meterId\": \"$METER_ID\",
    \"reading\": 1000,
    \"readingDate\": \"$READING_DATE1\",
    \"source\": \"manual\",
    \"notes\": \"Initial reading\"
  }")

echo "$CREATE_READING1"

READING_ID1=$(echo "$CREATE_READING1" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$READING_ID1" ]; then
  echo -e "${RED}❌ Failed to create reading${NC}"
  echo -e "${YELLOW}Response: $CREATE_READING1${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Reading created with ID: $READING_ID1${NC}\n"

# Step 7: Verify meter was updated with lastReading
echo -e "${YELLOW}Step 7: GET /api/meters/$METER_ID (Verify meter lastReading updated)...${NC}"
GET_METER=$(curl -s -X GET "$BASE_URL/api/meters/$METER_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$GET_METER"

LAST_READING=$(echo "$GET_METER" | grep -o '"lastReading":[0-9]*' | cut -d':' -f2)
if [ "$LAST_READING" = "1000" ]; then
  echo -e "${GREEN}✅ Meter lastReading updated to 1000${NC}"
fi
echo ""

# Step 8: Test GET /api/meter-readings/[id] (Get single reading)
echo -e "${YELLOW}Step 8: GET /api/meter-readings/$READING_ID1 (Get single reading)...${NC}"
GET_READING=$(curl -s -X GET "$BASE_URL/api/meter-readings/$READING_ID1" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$GET_READING"
echo ""

# Step 9: Test POST /api/meter-readings (Create second reading)
echo -e "${YELLOW}Step 9: POST /api/meter-readings (Create second reading - higher value)...${NC}"

sleep 1
READING_DATE2=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

CREATE_READING2=$(curl -s -X POST "$BASE_URL/api/meter-readings" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d "{
    \"meterId\": \"$METER_ID\",
    \"reading\": 1500,
    \"readingDate\": \"$READING_DATE2\",
    \"source\": \"manual\",
    \"notes\": \"Monthly reading\"
  }")

echo "$CREATE_READING2"

READING_ID2=$(echo "$CREATE_READING2" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$READING_ID2" ]; then
  echo -e "${RED}❌ Failed to create second reading${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Second reading created with ID: $READING_ID2${NC}\n"

# Step 10: Test GET /api/meter-readings?meterId=... (Filter by meter)
echo -e "${YELLOW}Step 10: GET /api/meter-readings?meterId=$METER_ID (Filter by meter)...${NC}"
FILTER_BY_METER=$(curl -s -X GET "$BASE_URL/api/meter-readings?meterId=$METER_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$FILTER_BY_METER"
echo ""

# Step 11: Test GET /api/meter-readings?meterId=...&limit=1 (Limit results)
echo -e "${YELLOW}Step 11: GET /api/meter-readings?meterId=$METER_ID&limit=1 (Limit to 1)...${NC}"
FILTER_LIMIT=$(curl -s -X GET "$BASE_URL/api/meter-readings?meterId=$METER_ID&limit=1" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$FILTER_LIMIT"
echo ""

# Step 12: Test calculateConsumption via GET with startDate and endDate
echo -e "${YELLOW}Step 12: GET /api/meter-readings?meterId=$METER_ID&startDate=$READING_DATE1&endDate=$READING_DATE2 (Calculate consumption)...${NC}"
CALCULATE_CONSUMPTION=$(curl -s -X GET "$BASE_URL/api/meter-readings?meterId=$METER_ID&startDate=$READING_DATE1&endDate=$READING_DATE2" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$CALCULATE_CONSUMPTION"

CONSUMPTION=$(echo "$CALCULATE_CONSUMPTION" | grep -o '"consumption":[0-9]*' | cut -d':' -f2)
if [ "$CONSUMPTION" = "500" ]; then
  echo -e "${GREEN}✅ Consumption calculated correctly: 500 (1500 - 1000)${NC}"
fi
echo ""

# Step 13: Test POST /api/meter-readings (Create third reading - should fail if reading is less than last)
echo -e "${YELLOW}Step 13: POST /api/meter-readings (Try to create reading with lower value - should fail)...${NC}"

sleep 1
READING_DATE3=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

CREATE_READING3_FAIL=$(curl -s -X POST "$BASE_URL/api/meter-readings" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d "{
    \"meterId\": \"$METER_ID\",
    \"reading\": 1200,
    \"readingDate\": \"$READING_DATE3\",
    \"source\": \"manual\"
  }")

echo "$CREATE_READING3_FAIL"

if echo "$CREATE_READING3_FAIL" | grep -q "error"; then
  echo -e "${GREEN}✅ Correctly rejected reading that is less than last reading${NC}"
fi
echo ""

# Step 14: Test POST /api/meter-readings with allowDecrease=true (Correction)
echo -e "${YELLOW}Step 14: POST /api/meter-readings (Create reading with allowDecrease=true for correction)...${NC}"

CREATE_READING3_CORRECT=$(curl -s -X POST "$BASE_URL/api/meter-readings" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d "{
    \"meterId\": \"$METER_ID\",
    \"reading\": 1200,
    \"readingDate\": \"$READING_DATE3\",
    \"source\": \"manual\",
    \"allowDecrease\": true,
    \"notes\": \"Correction reading\"
  }")

echo "$CREATE_READING3_CORRECT"

READING_ID3=$(echo "$CREATE_READING3_CORRECT" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ ! -z "$READING_ID3" ]; then
  echo -e "${GREEN}✅ Correction reading created with allowDecrease=true${NC}"
fi
echo ""

# Step 15: Test PATCH /api/meter-readings/[id] (Update reading)
echo -e "${YELLOW}Step 15: PATCH /api/meter-readings/$READING_ID2 (Update reading)...${NC}"

UPDATE_READING=$(curl -s -X PATCH "$BASE_URL/api/meter-readings/$READING_ID2" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d '{
    "reading": 1550,
    "notes": "Updated reading - corrected value"
  }')

echo "$UPDATE_READING"
echo ""

# Step 16: Test GET /api/meter-readings/[id] again (Verify update)
echo -e "${YELLOW}Step 16: GET /api/meter-readings/$READING_ID2 (Verify update)...${NC}"
GET_UPDATED=$(curl -s -X GET "$BASE_URL/api/meter-readings/$READING_ID2" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$GET_UPDATED"

UPDATED_READING=$(echo "$GET_UPDATED" | grep -o '"reading":[0-9]*' | cut -d':' -f2)
if [ "$UPDATED_READING" = "1550" ]; then
  echo -e "${GREEN}✅ Reading updated to 1550${NC}"
fi
echo ""

# Step 17: Create another reading (for testing deletion)
echo -e "${YELLOW}Step 17: POST /api/meter-readings (Create another reading for deletion test)...${NC}"

sleep 1
READING_DATE4=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

CREATE_READING4=$(curl -s -X POST "$BASE_URL/api/meter-readings" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d "{
    \"meterId\": \"$METER_ID\",
    \"reading\": 2000,
    \"readingDate\": \"$READING_DATE4\",
    \"source\": \"iot\",
    \"notes\": \"IoT reading\"
  }")

READING_ID4=$(echo "$CREATE_READING4" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "$CREATE_READING4"
echo ""

# Step 18: Test DELETE /api/meter-readings/[id] (Delete reading)
echo -e "${YELLOW}Step 18: DELETE /api/meter-readings/$READING_ID4 (Delete reading)...${NC}"
DELETE_READING=$(curl -s -X DELETE "$BASE_URL/api/meter-readings/$READING_ID4" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$DELETE_READING"
echo ""

# Step 19: Test GET /api/meter-readings/[id] again (Verify deletion)
echo -e "${YELLOW}Step 19: GET /api/meter-readings/$READING_ID4 (Verify deletion - should return 404)...${NC}"
GET_DELETED=$(curl -s -X GET "$BASE_URL/api/meter-readings/$READING_ID4" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$GET_DELETED"

if echo "$GET_DELETED" | grep -q "not found"; then
  echo -e "${GREEN}✅ Reading deleted successfully${NC}"
fi
echo ""

# Step 20: Verify meter lastReading was updated after deletion
echo -e "${YELLOW}Step 20: GET /api/meters/$METER_ID (Verify meter lastReading updated after deletion)...${NC}"
GET_METER_AFTER_DELETE=$(curl -s -X GET "$BASE_URL/api/meters/$METER_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$GET_METER_AFTER_DELETE"

LAST_READING_AFTER=$(echo "$GET_METER_AFTER_DELETE" | grep -o '"lastReading":[0-9]*' | cut -d':' -f2)
echo -e "${GREEN}✅ Meter lastReading after deletion: $LAST_READING_AFTER${NC}"
echo ""

# Step 21: Test GET /api/meter-readings (List all readings)
echo -e "${YELLOW}Step 21: GET /api/meter-readings (List all readings)...${NC}"
LIST_ALL=$(curl -s -X GET "$BASE_URL/api/meter-readings" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$LIST_ALL"
echo ""

# Step 22: Test GET /api/meter-readings with date range filter
echo -e "${YELLOW}Step 22: GET /api/meter-readings?startDate=$READING_DATE1&endDate=$READING_DATE3 (Filter by date range)...${NC}"
FILTER_DATE_RANGE=$(curl -s -X GET "$BASE_URL/api/meter-readings?startDate=$READING_DATE1&endDate=$READING_DATE3" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$FILTER_DATE_RANGE"
echo ""

echo -e "${GREEN}=== All meter readings API tests completed! ===${NC}"

# Cleanup
rm -f /tmp/bms_meter_readings_cookies.txt
rm -f /tmp/bms_meter_readings_super_cookies.txt

