#!/bin/bash

# Test script for Financial and Occupancy Reports API
# Make sure the dev server is running: npm run dev

BASE_URL="http://localhost:3000"
SESSION_COOKIE="bms_session"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== BMS Reports API Test Script ===${NC}\n"

# Check if server is running
if ! curl -s "$BASE_URL/api/health" > /dev/null 2>&1; then
  echo -e "${RED}❌ Server is not running at $BASE_URL${NC}"
  echo -e "${YELLOW}Please start the dev server with: npm run dev${NC}"
  exit 1
fi

# Step 1: Login as ORG_ADMIN
echo -e "${YELLOW}Step 1: Logging in as ORG_ADMIN...${NC}"
ORG_ADMIN_LOGIN=$(curl -s -c /tmp/bms_reports_cookies.txt -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"identifier": "admin@example.com", "password": "ChangeMe123!"}')

echo "$ORG_ADMIN_LOGIN"

ORG_ADMIN_SESSION=$(grep "$SESSION_COOKIE" /tmp/bms_reports_cookies.txt | awk '{print $7}')

if [ -z "$ORG_ADMIN_SESSION" ]; then
  echo -e "${RED}❌ Failed to get ORG_ADMIN session token${NC}"
  exit 1
fi

echo -e "${GREEN}✅ ORG_ADMIN session token obtained${NC}\n"

# Step 2: Test GET /api/reports/financial (without filters)
echo -e "${YELLOW}Step 2: GET /api/reports/financial (All time, all buildings)...${NC}"
FINANCIAL_REPORT=$(curl -s -X GET "$BASE_URL/api/reports/financial" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")

echo "$FINANCIAL_REPORT" | head -50
echo -e "${GREEN}✅ Financial report retrieved${NC}\n"

# Step 3: Test GET /api/reports/financial (with date range)
echo -e "${YELLOW}Step 3: GET /api/reports/financial (With date range)...${NC}"

START_DATE=$(date -u -d "1 month ago" +"%Y-%m-01T00:00:00.000Z" 2>/dev/null || date -u -v-1m +"%Y-%m-01T00:00:00.000Z" 2>/dev/null || echo "")
END_DATE=$(date -u +"%Y-%m-%dT23:59:59.000Z" 2>/dev/null || echo "")

if [ -z "$START_DATE" ]; then
  START_DATE=$(node -e "const d = new Date(); d.setMonth(d.getMonth() - 1); d.setDate(1); console.log(d.toISOString())" 2>/dev/null || echo "")
fi

FINANCIAL_REPORT_RANGE=$(curl -s -X GET "$BASE_URL/api/reports/financial?startDate=$START_DATE&endDate=$END_DATE" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")

echo "$FINANCIAL_REPORT_RANGE" | head -50
echo -e "${GREEN}✅ Financial report with date range retrieved${NC}\n"

# Step 4: Test GET /api/reports/financial (with building filter)
echo -e "${YELLOW}Step 4: GET /api/reports/financial (With building filter)...${NC}"

# Get a building ID
BUILDINGS=$(curl -s -X GET "$BASE_URL/api/buildings" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")

BUILDING_ID=$(echo "$BUILDINGS" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$BUILDING_ID" ]; then
  FINANCIAL_REPORT_BUILDING=$(curl -s -X GET "$BASE_URL/api/reports/financial?buildingId=$BUILDING_ID" \
    -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
    -H "Content-Type: application/json")

  echo "$FINANCIAL_REPORT_BUILDING" | head -50
  echo -e "${GREEN}✅ Financial report for building retrieved${NC}\n"
else
  echo -e "${YELLOW}⚠️  No buildings found, skipping building filter test${NC}\n"
fi

# Step 5: Test GET /api/reports/occupancy (without filters)
echo -e "${YELLOW}Step 5: GET /api/reports/occupancy (All buildings)...${NC}"
OCCUPANCY_REPORT=$(curl -s -X GET "$BASE_URL/api/reports/occupancy" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")

echo "$OCCUPANCY_REPORT"
echo -e "${GREEN}✅ Occupancy report retrieved${NC}\n"

# Step 6: Test GET /api/reports/occupancy (with building filter)
echo -e "${YELLOW}Step 6: GET /api/reports/occupancy (With building filter)...${NC}"

if [ -n "$BUILDING_ID" ]; then
  OCCUPANCY_REPORT_BUILDING=$(curl -s -X GET "$BASE_URL/api/reports/occupancy?buildingId=$BUILDING_ID" \
    -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
    -H "Content-Type: application/json")

  echo "$OCCUPANCY_REPORT_BUILDING"
  echo -e "${GREEN}✅ Occupancy report for building retrieved${NC}\n"
else
  echo -e "${YELLOW}⚠️  No buildings found, skipping building filter test${NC}\n"
fi

# Step 7: Test GET /api/dashboard/stats (Updated dashboard stats)
echo -e "${YELLOW}Step 7: GET /api/dashboard/stats (Updated dashboard stats)...${NC}"
DASHBOARD_STATS=$(curl -s -X GET "$BASE_URL/api/dashboard/stats" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")

echo "$DASHBOARD_STATS"
echo -e "${GREEN}✅ Dashboard stats retrieved${NC}\n"

# Step 8: Test error cases
echo -e "${YELLOW}Step 8: Testing error cases...${NC}"

# Invalid date range
INVALID_DATE_RANGE=$(curl -s -X GET "$BASE_URL/api/reports/financial?startDate=invalid&endDate=invalid" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")

if echo "$INVALID_DATE_RANGE" | grep -q '"error"'; then
  echo -e "${GREEN}✅ Invalid date range correctly rejected${NC}"
else
  echo -e "${RED}❌ Invalid date range should be rejected${NC}"
fi

# Invalid building ID
INVALID_BUILDING=$(curl -s -X GET "$BASE_URL/api/reports/financial?buildingId=invalid123" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")

if echo "$INVALID_BUILDING" | grep -q '"error"'; then
  echo -e "${GREEN}✅ Invalid building ID correctly rejected${NC}"
else
  echo -e "${RED}❌ Invalid building ID should be rejected${NC}"
fi

echo ""

echo -e "${GREEN}=== All tests completed! ===${NC}"

# Cleanup
rm -f /tmp/bms_reports_cookies.txt

































