#!/bin/bash

# Test script for Visitor Logs CRUD API endpoints
# Make sure the dev server is running: npm run dev

BASE_URL="http://localhost:3000"
SESSION_COOKIE="bms_session"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== BMS Visitor Logs API Test Script ===${NC}\n"

# Check if server is running
if ! curl -s "$BASE_URL/api/health" > /dev/null 2>&1; then
  echo -e "${RED}❌ Server is not running at $BASE_URL${NC}"
  echo -e "${YELLOW}Please start the dev server with: npm run dev${NC}"
  exit 1
fi

# Step 1: Login as ORG_ADMIN (or BUILDING_MANAGER)
echo -e "${YELLOW}Step 1: Logging in as ORG_ADMIN...${NC}"
ORG_ADMIN_LOGIN=$(curl -s -c /tmp/bms_visitor_logs_cookies.txt -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"identifier": "admin@example.com", "password": "ChangeMe123!"}')

echo "$ORG_ADMIN_LOGIN"

ORG_ADMIN_SESSION=$(grep "$SESSION_COOKIE" /tmp/bms_visitor_logs_cookies.txt | awk '{print $7}')

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
      "name": "Test Building for Visitor Logs",
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

# Step 3: Get or create a tenant
echo -e "${YELLOW}Step 3: Getting or creating a tenant...${NC}"

LIST_TENANTS=$(curl -s -X GET "$BASE_URL/api/tenants?status=active" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")

TENANT_ID=$(echo "$LIST_TENANTS" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$TENANT_ID" ]; then
  CREATE_TENANT=$(curl -s -X POST "$BASE_URL/api/tenants" \
    -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
    -H "Content-Type: application/json" \
    -d '{
      "firstName": "Host",
      "lastName": "Tenant",
      "primaryPhone": "+251911234568",
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

# Step 4: Get or create a unit (optional)
echo -e "${YELLOW}Step 4: Getting or creating a unit (optional)...${NC}"

LIST_UNITS=$(curl -s -X GET "$BASE_URL/api/units?buildingId=$BUILDING_ID&status=occupied" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")

UNIT_ID=$(echo "$LIST_UNITS" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$UNIT_ID" ]; then
  CREATE_UNIT=$(curl -s -X POST "$BASE_URL/api/units" \
    -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
    -H "Content-Type: application/json" \
    -d "{
      \"buildingId\": \"$BUILDING_ID\",
      \"unitNumber\": \"A-201\",
      \"unitType\": \"apartment\",
      \"floor\": 2,
      \"area\": 60,
      \"bedrooms\": 2,
      \"bathrooms\": 1,
      \"status\": \"occupied\",
      \"rentAmount\": 6000
    }")
  UNIT_ID=$(echo "$CREATE_UNIT" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
fi

if [ ! -z "$UNIT_ID" ]; then
  echo -e "${GREEN}✅ Unit ID: $UNIT_ID${NC}\n"
fi

# Step 5: Get or create a parking space (optional)
echo -e "${YELLOW}Step 5: Getting or creating a parking space (optional)...${NC}"

LIST_SPACES=$(curl -s -X GET "$BASE_URL/api/parking-spaces?buildingId=$BUILDING_ID&status=available" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")

PARKING_SPACE_ID=$(echo "$LIST_SPACES" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$PARKING_SPACE_ID" ]; then
  CREATE_SPACE=$(curl -s -X POST "$BASE_URL/api/parking-spaces" \
    -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
    -H "Content-Type: application/json" \
    -d "{
      \"buildingId\": \"$BUILDING_ID\",
      \"spaceNumber\": \"V-002\",
      \"spaceType\": \"visitor\",
      \"status\": \"available\"
    }")
  PARKING_SPACE_ID=$(echo "$CREATE_SPACE" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
fi

if [ ! -z "$PARKING_SPACE_ID" ]; then
  echo -e "${GREEN}✅ Parking Space ID: $PARKING_SPACE_ID${NC}\n"
fi

# Step 6: Ensure indexes (using SUPER_ADMIN session)
echo -e "${YELLOW}Step 6: Ensuring database indexes...${NC}"
SUPER_ADMIN_LOGIN=$(curl -s -c /tmp/bms_visitor_logs_super_cookies.txt -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"identifier": "superadmin@bms.local", "password": "SuperAdmin123!"}')

SUPER_ADMIN_SESSION=$(grep "$SESSION_COOKIE" /tmp/bms_visitor_logs_super_cookies.txt | awk '{print $7}')

if [ ! -z "$SUPER_ADMIN_SESSION" ]; then
  ENSURE_INDEXES=$(curl -s -X POST "$BASE_URL/api/admin/ensure-indexes" \
    -b "$SESSION_COOKIE=$SUPER_ADMIN_SESSION" \
    -H "Content-Type: application/json")
  echo "$ENSURE_INDEXES"
  echo ""
fi

# Step 7: Test GET /api/visitor-logs (List visitor logs - should be empty initially)
echo -e "${YELLOW}Step 7: GET /api/visitor-logs (List visitor logs)...${NC}"
LIST_LOGS=$(curl -s -X GET "$BASE_URL/api/visitor-logs" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$LIST_LOGS"
echo ""

# Step 8: Test POST /api/visitor-logs (Create visitor log entry)
echo -e "${YELLOW}Step 8: POST /api/visitor-logs (Create visitor log entry)...${NC}"

ENTRY_TIME=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

CREATE_LOG=$(curl -s -X POST "$BASE_URL/api/visitor-logs" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d "{
    \"buildingId\": \"$BUILDING_ID\",
    \"visitorName\": \"John Doe\",
    \"visitorPhone\": \"+251911111111\",
    \"visitorIdNumber\": \"1234567890\",
    \"hostTenantId\": \"$TENANT_ID\",
    \"hostUnitId\": \"$UNIT_ID\",
    \"purpose\": \"Meeting\",
    \"vehiclePlateNumber\": \"VIS-001\",
    \"parkingSpaceId\": \"$PARKING_SPACE_ID\",
    \"entryTime\": \"$ENTRY_TIME\",
    \"notes\": \"Test visitor log entry\"
  }")

echo "$CREATE_LOG"

LOG_ID=$(echo "$CREATE_LOG" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$LOG_ID" ]; then
  echo -e "${RED}❌ Failed to create visitor log${NC}"
  echo -e "${YELLOW}Response: $CREATE_LOG${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Visitor log created with ID: $LOG_ID${NC}\n"

# Step 9: Test GET /api/visitor-logs/[id] (Get single visitor log)
echo -e "${YELLOW}Step 9: GET /api/visitor-logs/$LOG_ID (Get single visitor log)...${NC}"
GET_LOG=$(curl -s -X GET "$BASE_URL/api/visitor-logs/$LOG_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$GET_LOG"
echo ""

# Step 10: Test GET /api/visitor-logs with filters
echo -e "${YELLOW}Step 10: GET /api/visitor-logs?buildingId=$BUILDING_ID (Filter by building)...${NC}"
FILTER_BY_BUILDING=$(curl -s -X GET "$BASE_URL/api/visitor-logs?buildingId=$BUILDING_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$FILTER_BY_BUILDING"
echo ""

echo -e "${YELLOW}Step 10b: GET /api/visitor-logs?hostTenantId=$TENANT_ID (Filter by host tenant)...${NC}"
FILTER_BY_TENANT=$(curl -s -X GET "$BASE_URL/api/visitor-logs?hostTenantId=$TENANT_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$FILTER_BY_TENANT"
echo ""

echo -e "${YELLOW}Step 10c: GET /api/visitor-logs?status=active (Filter by active status)...${NC}"
FILTER_BY_ACTIVE=$(curl -s -X GET "$BASE_URL/api/visitor-logs?status=active" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$FILTER_BY_ACTIVE"
echo ""

# Step 11: Test PATCH /api/visitor-logs/[id] (Update exit time)
echo -e "${YELLOW}Step 11: PATCH /api/visitor-logs/$LOG_ID (Update exit time)...${NC}"

EXIT_TIME=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

UPDATE_EXIT=$(curl -s -X PATCH "$BASE_URL/api/visitor-logs/$LOG_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d "{
    \"exitTime\": \"$EXIT_TIME\"
  }")
echo "$UPDATE_EXIT"
echo ""

# Step 12: Test GET /api/visitor-logs/[id] again (Verify exit time update)
echo -e "${YELLOW}Step 12: GET /api/visitor-logs/$LOG_ID (Verify exit time update)...${NC}"
GET_UPDATED=$(curl -s -X GET "$BASE_URL/api/visitor-logs/$LOG_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$GET_UPDATED"
echo ""

UPDATED_EXIT_TIME=$(echo "$GET_UPDATED" | grep -o '"exitTime":"[^"]*"' | cut -d'"' -f4)
if [ ! -z "$UPDATED_EXIT_TIME" ]; then
  echo -e "${GREEN}✅ Visitor log exit time updated${NC}"
fi
echo ""

# Step 13: Test GET /api/visitor-logs?status=completed (Filter by completed status)
echo -e "${YELLOW}Step 13: GET /api/visitor-logs?status=completed (Filter by completed status)...${NC}"
FILTER_BY_COMPLETED=$(curl -s -X GET "$BASE_URL/api/visitor-logs?status=completed" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$FILTER_BY_COMPLETED"
echo ""

# Step 14: Create another visitor log (without exit time - active)
echo -e "${YELLOW}Step 14: POST /api/visitor-logs (Create another visitor log - active)...${NC}"

ENTRY_TIME2=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

CREATE_LOG2=$(curl -s -X POST "$BASE_URL/api/visitor-logs" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d "{
    \"buildingId\": \"$BUILDING_ID\",
    \"visitorName\": \"Jane Smith\",
    \"visitorPhone\": \"+251922222222\",
    \"hostTenantId\": \"$TENANT_ID\",
    \"purpose\": \"Delivery\",
    \"entryTime\": \"$ENTRY_TIME2\",
    \"notes\": \"Active visitor log\"
  }")

LOG_ID2=$(echo "$CREATE_LOG2" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "$CREATE_LOG2"
echo ""

# Step 15: Test GET /api/visitor-logs?status=active again (Should show active visitor)
echo -e "${YELLOW}Step 15: GET /api/visitor-logs?status=active (Should show active visitor)...${NC}"
FILTER_ACTIVE_AGAIN=$(curl -s -X GET "$BASE_URL/api/visitor-logs?status=active" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$FILTER_ACTIVE_AGAIN"
echo ""

# Step 16: Test date range filtering
echo -e "${YELLOW}Step 16: GET /api/visitor-logs?startDate=...&endDate=... (Filter by date range)...${NC}"

START_DATE=$(date -u -d "1 day ago" +"%Y-%m-%dT%H:%M:%S.000Z")
END_DATE=$(date -u -d "1 day" +"%Y-%m-%dT%H:%M:%S.000Z")

FILTER_BY_DATE=$(curl -s -X GET "$BASE_URL/api/visitor-logs?startDate=$START_DATE&endDate=$END_DATE" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$FILTER_BY_DATE"
echo ""

# Step 17: Test GET /api/visitor-logs (List all visitor logs)
echo -e "${YELLOW}Step 17: GET /api/visitor-logs (List all visitor logs)...${NC}"
LIST_ALL=$(curl -s -X GET "$BASE_URL/api/visitor-logs" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$LIST_ALL"
echo ""

echo -e "${GREEN}=== All visitor logs API tests completed! ===${NC}"

# Cleanup
rm -f /tmp/bms_visitor_logs_cookies.txt
rm -f /tmp/bms_visitor_logs_super_cookies.txt



















