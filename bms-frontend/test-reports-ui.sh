#!/bin/bash

# Test script for Reporting UI (Step 4 - Phase 6)
# Make sure the dev server is running: npm run dev

BASE_URL="http://localhost:3000"
SESSION_COOKIE="bms_session"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== BMS Reporting UI Test Script ===${NC}\n"

# Check if server is running
if ! curl -s "$BASE_URL/api/health" > /dev/null 2>&1; then
  echo -e "${RED}❌ Server is not running at $BASE_URL${NC}"
  echo -e "${YELLOW}Please start the dev server with: npm run dev${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Server is running${NC}\n"

# Step 1: Login as ORG_ADMIN
echo -e "${YELLOW}Step 1: Logging in as ORG_ADMIN...${NC}"
ORG_ADMIN_LOGIN=$(curl -s -c /tmp/bms_reports_ui_cookies.txt -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"identifier": "admin@example.com", "password": "ChangeMe123!"}')

echo "$ORG_ADMIN_LOGIN"

ORG_ADMIN_SESSION=$(grep "$SESSION_COOKIE" /tmp/bms_reports_ui_cookies.txt | awk '{print $7}')

if [ -z "$ORG_ADMIN_SESSION" ]; then
  echo -e "${RED}❌ Failed to get ORG_ADMIN session token${NC}"
  exit 1
fi

echo -e "${GREEN}✅ ORG_ADMIN session token obtained${NC}\n"

# Step 2: Test GET /api/reports/financial
echo -e "${YELLOW}Step 2: Testing Financial Reports API...${NC}"
FINANCIAL_REPORT=$(curl -s -X GET "$BASE_URL/api/reports/financial" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")

if echo "$FINANCIAL_REPORT" | grep -q '"totalRevenue"'; then
  echo -e "${GREEN}✅ Financial report API working${NC}"
else
  echo -e "${RED}❌ Financial report API failed${NC}"
  echo "$FINANCIAL_REPORT"
fi

# Step 3: Test GET /api/reports/occupancy
echo -e "\n${YELLOW}Step 3: Testing Occupancy Reports API...${NC}"
OCCUPANCY_REPORT=$(curl -s -X GET "$BASE_URL/api/reports/occupancy" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")

if echo "$OCCUPANCY_REPORT" | grep -q '"summary"'; then
  echo -e "${GREEN}✅ Occupancy report API working${NC}"
else
  echo -e "${RED}❌ Occupancy report API failed${NC}"
  echo "$OCCUPANCY_REPORT"
fi

# Step 4: Test GET /api/reports/operational
echo -e "\n${YELLOW}Step 4: Testing Operational Reports API...${NC}"
OPERATIONAL_REPORT=$(curl -s -X GET "$BASE_URL/api/reports/operational" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")

if echo "$OPERATIONAL_REPORT" | grep -q '"complaints"'; then
  echo -e "${GREEN}✅ Operational report API working${NC}"
else
  echo -e "${RED}❌ Operational report API failed${NC}"
  echo "$OPERATIONAL_REPORT"
fi

# Step 5: Test Financial Reports with date range
echo -e "\n${YELLOW}Step 5: Testing Financial Reports with date range...${NC}"
START_DATE=$(date -u -d "1 month ago" +"%Y-%m-01T00:00:00.000Z" 2>/dev/null || date -u -v-1m +"%Y-%m-01T00:00:00.000Z" 2>/dev/null || echo "")
END_DATE=$(date -u +"%Y-%m-%dT23:59:59.000Z" 2>/dev/null || echo "")

if [ -z "$START_DATE" ]; then
  START_DATE=$(node -e "const d = new Date(); d.setMonth(d.getMonth() - 1); d.setDate(1); console.log(d.toISOString())" 2>/dev/null || echo "")
fi

FINANCIAL_REPORT_RANGE=$(curl -s -X GET "$BASE_URL/api/reports/financial?startDate=$START_DATE&endDate=$END_DATE" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")

if echo "$FINANCIAL_REPORT_RANGE" | grep -q '"totalRevenue"'; then
  echo -e "${GREEN}✅ Financial report with date range working${NC}"
else
  echo -e "${RED}❌ Financial report with date range failed${NC}"
fi

# Step 6: Test Operational Reports with date range
echo -e "\n${YELLOW}Step 6: Testing Operational Reports with date range...${NC}"
OPERATIONAL_REPORT_RANGE=$(curl -s -X GET "$BASE_URL/api/reports/operational?startDate=$START_DATE&endDate=$END_DATE" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")

if echo "$OPERATIONAL_REPORT_RANGE" | grep -q '"complaints"'; then
  echo -e "${GREEN}✅ Operational report with date range working${NC}"
else
  echo -e "${RED}❌ Operational report with date range failed${NC}"
fi

# Step 7: Test building filter
echo -e "\n${YELLOW}Step 7: Testing building filter...${NC}"

# Get a building ID
BUILDINGS=$(curl -s -X GET "$BASE_URL/api/buildings" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")

BUILDING_ID=$(echo "$BUILDINGS" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$BUILDING_ID" ]; then
  FINANCIAL_REPORT_BUILDING=$(curl -s -X GET "$BASE_URL/api/reports/financial?buildingId=$BUILDING_ID" \
    -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
    -H "Content-Type: application/json")

  if echo "$FINANCIAL_REPORT_BUILDING" | grep -q '"totalRevenue"'; then
    echo -e "${GREEN}✅ Financial report with building filter working${NC}"
  else
    echo -e "${RED}❌ Financial report with building filter failed${NC}"
  fi

  OCCUPANCY_REPORT_BUILDING=$(curl -s -X GET "$BASE_URL/api/reports/occupancy?buildingId=$BUILDING_ID" \
    -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
    -H "Content-Type: application/json")

  if echo "$OCCUPANCY_REPORT_BUILDING" | grep -q '"summary"'; then
    echo -e "${GREEN}✅ Occupancy report with building filter working${NC}"
  else
    echo -e "${RED}❌ Occupancy report with building filter failed${NC}"
  fi

  OPERATIONAL_REPORT_BUILDING=$(curl -s -X GET "$BASE_URL/api/reports/operational?buildingId=$BUILDING_ID" \
    -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
    -H "Content-Type: application/json")

  if echo "$OPERATIONAL_REPORT_BUILDING" | grep -q '"complaints"'; then
    echo -e "${GREEN}✅ Operational report with building filter working${NC}"
  else
    echo -e "${RED}❌ Operational report with building filter failed${NC}"
  fi
else
  echo -e "${YELLOW}⚠️  No buildings found, skipping building filter test${NC}"
fi

# Step 8: Test error cases
echo -e "\n${YELLOW}Step 8: Testing error cases...${NC}"

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
echo -e "${GREEN}=== All API tests completed! ===${NC}"
echo -e "${YELLOW}Note: UI pages should be manually tested in the browser at:${NC}"
echo -e "  - ${BASE_URL}/org/reports"
echo -e "  - ${BASE_URL}/org/reports/financial"
echo -e "  - ${BASE_URL}/org/reports/occupancy"
echo -e "  - ${BASE_URL}/org/reports/operational"

# Cleanup
rm -f /tmp/bms_reports_ui_cookies.txt



















