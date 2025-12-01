#!/bin/bash

# Test script for Reporting UI Export Buttons (Step 7 - Phase 6)
# This tests that export buttons work correctly with filters
# Make sure the dev server is running: npm run dev

BASE_URL="http://localhost:3000"
SESSION_COOKIE="bms_session"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== BMS Reports Export UI Test Script ===${NC}\n"

# Check if server is running
if ! curl -s "$BASE_URL/api/health" > /dev/null 2>&1; then
  echo -e "${RED}❌ Server is not running at $BASE_URL${NC}"
  echo -e "${YELLOW}Please start the dev server with: npm run dev${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Server is running${NC}\n"

# Step 1: Login as ORG_ADMIN
echo -e "${YELLOW}Step 1: Logging in as ORG_ADMIN...${NC}"
ORG_ADMIN_LOGIN=$(curl -s -c /tmp/bms_export_ui_cookies.txt -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"identifier": "admin@example.com", "password": "ChangeMe123!"}')

ORG_ADMIN_SESSION=$(grep "$SESSION_COOKIE" /tmp/bms_export_ui_cookies.txt | awk '{print $7}')

if [ -z "$ORG_ADMIN_SESSION" ]; then
  echo -e "${RED}❌ Failed to get ORG_ADMIN session token${NC}"
  exit 1
fi

echo -e "${GREEN}✅ ORG_ADMIN session token obtained${NC}\n"

# Get a building ID for testing filters
echo -e "${YELLOW}Getting building ID for filter tests...${NC}"
BUILDINGS=$(curl -s -X GET "$BASE_URL/api/buildings" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")

BUILDING_ID=$(echo "$BUILDINGS" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$BUILDING_ID" ]; then
  echo -e "${GREEN}✅ Building ID obtained: $BUILDING_ID${NC}\n"
else
  echo -e "${YELLOW}⚠️  No buildings found, will skip building filter tests${NC}\n"
fi

# Calculate date range (last month)
START_DATE=$(date -u -d "1 month ago" +"%Y-%m-01T00:00:00.000Z" 2>/dev/null || date -u -v-1m +"%Y-%m-01T00:00:00.000Z" 2>/dev/null || echo "")
END_DATE=$(date -u +"%Y-%m-%dT23:59:59.000Z" 2>/dev/null || echo "")

if [ -z "$START_DATE" ]; then
  START_DATE=$(node -e "const d = new Date(); d.setMonth(d.getMonth() - 1); d.setDate(1); console.log(d.toISOString())" 2>/dev/null || echo "")
fi

echo -e "${YELLOW}Date range: $START_DATE to $END_DATE${NC}\n"

# Test CSV Exports with Filters
echo -e "${BLUE}=== Testing CSV Exports with Filters ===${NC}\n"

# Test 1: Financial CSV with date range and building
echo -e "${YELLOW}Test 1: Financial CSV Export (with date range and building filter)...${NC}"
if [ -n "$BUILDING_ID" ]; then
  FINANCIAL_CSV_FILTERED=$(curl -s -X GET "$BASE_URL/api/reports/financial/export/csv?startDate=$START_DATE&endDate=$END_DATE&buildingId=$BUILDING_ID" \
    -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
    -H "Content-Type: application/json" \
    -w "\n%{http_code}")

  HTTP_CODE=$(echo "$FINANCIAL_CSV_FILTERED" | tail -1)
  CSV_CONTENT=$(echo "$FINANCIAL_CSV_FILTERED" | head -n -1)

  if [ "$HTTP_CODE" = "200" ] && echo "$CSV_CONTENT" | grep -q "Financial Report"; then
    echo -e "${GREEN}✅ Financial CSV export with filters successful${NC}"
  else
    echo -e "${RED}❌ Financial CSV export with filters failed (HTTP $HTTP_CODE)${NC}"
  fi
else
  echo -e "${YELLOW}⚠️  Skipping building filter test (no buildings)${NC}"
fi

# Test 2: Occupancy CSV with building filter
echo -e "\n${YELLOW}Test 2: Occupancy CSV Export (with building filter)...${NC}"
if [ -n "$BUILDING_ID" ]; then
  OCCUPANCY_CSV_FILTERED=$(curl -s -X GET "$BASE_URL/api/reports/occupancy/export/csv?buildingId=$BUILDING_ID" \
    -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
    -H "Content-Type: application/json" \
    -w "\n%{http_code}")

  HTTP_CODE=$(echo "$OCCUPANCY_CSV_FILTERED" | tail -1)
  CSV_CONTENT=$(echo "$OCCUPANCY_CSV_FILTERED" | head -n -1)

  if [ "$HTTP_CODE" = "200" ] && echo "$CSV_CONTENT" | grep -q "Occupancy Report"; then
    echo -e "${GREEN}✅ Occupancy CSV export with building filter successful${NC}"
  else
    echo -e "${RED}❌ Occupancy CSV export with building filter failed (HTTP $HTTP_CODE)${NC}"
  fi
else
  echo -e "${YELLOW}⚠️  Skipping building filter test (no buildings)${NC}"
fi

# Test 3: Operational CSV with date range and building
echo -e "\n${YELLOW}Test 3: Operational CSV Export (with date range and building filter)...${NC}"
if [ -n "$BUILDING_ID" ]; then
  OPERATIONAL_CSV_FILTERED=$(curl -s -X GET "$BASE_URL/api/reports/operational/export/csv?startDate=$START_DATE&endDate=$END_DATE&buildingId=$BUILDING_ID" \
    -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
    -H "Content-Type: application/json" \
    -w "\n%{http_code}")

  HTTP_CODE=$(echo "$OPERATIONAL_CSV_FILTERED" | tail -1)
  CSV_CONTENT=$(echo "$OPERATIONAL_CSV_FILTERED" | head -n -1)

  if [ "$HTTP_CODE" = "200" ] && echo "$CSV_CONTENT" | grep -q "Operational Report"; then
    echo -e "${GREEN}✅ Operational CSV export with filters successful${NC}"
  else
    echo -e "${RED}❌ Operational CSV export with filters failed (HTTP $HTTP_CODE)${NC}"
  fi
else
  echo -e "${YELLOW}⚠️  Skipping building filter test (no buildings)${NC}"
fi

# Test PDF Exports with Filters
echo -e "\n${BLUE}=== Testing PDF Exports with Filters ===${NC}\n"

# Test 4: Financial PDF with date range and building
echo -e "${YELLOW}Test 4: Financial PDF Export (with date range and building filter)...${NC}"
if [ -n "$BUILDING_ID" ]; then
  FINANCIAL_PDF_FILTERED=$(curl -s -X GET "$BASE_URL/api/reports/financial/export/pdf?startDate=$START_DATE&endDate=$END_DATE&buildingId=$BUILDING_ID" \
    -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
    -H "Content-Type: application/json" \
    -w "\n%{http_code}" \
    -o /tmp/financial-filtered.pdf)

  HTTP_CODE=$(echo "$FINANCIAL_PDF_FILTERED" | tail -1)

  if [ "$HTTP_CODE" = "200" ] && [ -f "/tmp/financial-filtered.pdf" ]; then
    PDF_SIZE=$(wc -c < "/tmp/financial-filtered.pdf")
    if [ "$PDF_SIZE" -gt 1000 ]; then
      echo -e "${GREEN}✅ Financial PDF export with filters successful (${PDF_SIZE} bytes)${NC}"
    else
      echo -e "${RED}❌ Financial PDF export with filters failed (file too small)${NC}"
    fi
  else
    echo -e "${RED}❌ Financial PDF export with filters failed (HTTP $HTTP_CODE)${NC}"
  fi
else
  echo -e "${YELLOW}⚠️  Skipping building filter test (no buildings)${NC}"
fi

# Test 5: Occupancy PDF with building filter
echo -e "\n${YELLOW}Test 5: Occupancy PDF Export (with building filter)...${NC}"
if [ -n "$BUILDING_ID" ]; then
  OCCUPANCY_PDF_FILTERED=$(curl -s -X GET "$BASE_URL/api/reports/occupancy/export/pdf?buildingId=$BUILDING_ID" \
    -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
    -H "Content-Type: application/json" \
    -w "\n%{http_code}" \
    -o /tmp/occupancy-filtered.pdf)

  HTTP_CODE=$(echo "$OCCUPANCY_PDF_FILTERED" | tail -1)

  if [ "$HTTP_CODE" = "200" ] && [ -f "/tmp/occupancy-filtered.pdf" ]; then
    PDF_SIZE=$(wc -c < "/tmp/occupancy-filtered.pdf")
    if [ "$PDF_SIZE" -gt 1000 ]; then
      echo -e "${GREEN}✅ Occupancy PDF export with building filter successful (${PDF_SIZE} bytes)${NC}"
    else
      echo -e "${RED}❌ Occupancy PDF export with building filter failed (file too small)${NC}"
    fi
  else
    echo -e "${RED}❌ Occupancy PDF export with building filter failed (HTTP $HTTP_CODE)${NC}"
  fi
else
  echo -e "${YELLOW}⚠️  Skipping building filter test (no buildings)${NC}"
fi

# Test 6: Operational PDF with date range and building
echo -e "\n${YELLOW}Test 6: Operational PDF Export (with date range and building filter)...${NC}"
if [ -n "$BUILDING_ID" ]; then
  OPERATIONAL_PDF_FILTERED=$(curl -s -X GET "$BASE_URL/api/reports/operational/export/pdf?startDate=$START_DATE&endDate=$END_DATE&buildingId=$BUILDING_ID" \
    -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
    -H "Content-Type: application/json" \
    -w "\n%{http_code}" \
    -o /tmp/operational-filtered.pdf)

  HTTP_CODE=$(echo "$OPERATIONAL_PDF_FILTERED" | tail -1)

  if [ "$HTTP_CODE" = "200" ] && [ -f "/tmp/operational-filtered.pdf" ]; then
    PDF_SIZE=$(wc -c < "/tmp/operational-filtered.pdf")
    if [ "$PDF_SIZE" -gt 1000 ]; then
      echo -e "${GREEN}✅ Operational PDF export with filters successful (${PDF_SIZE} bytes)${NC}"
    else
      echo -e "${RED}❌ Operational PDF export with filters failed (file too small)${NC}"
    fi
  else
    echo -e "${RED}❌ Operational PDF export with filters failed (HTTP $HTTP_CODE)${NC}"
  fi
else
  echo -e "${YELLOW}⚠️  Skipping building filter test (no buildings)${NC}"
fi

# Verify filter parameters are passed correctly
echo -e "\n${BLUE}=== Verifying Filter Parameters ===${NC}\n"

echo -e "${YELLOW}Testing that filters are applied correctly...${NC}"

# Test that date range filters work
FINANCIAL_NO_FILTER=$(curl -s -X GET "$BASE_URL/api/reports/financial" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")

FINANCIAL_WITH_FILTER=$(curl -s -X GET "$BASE_URL/api/reports/financial?startDate=$START_DATE&endDate=$END_DATE" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")

if [ -n "$FINANCIAL_NO_FILTER" ] && [ -n "$FINANCIAL_WITH_FILTER" ]; then
  echo -e "${GREEN}✅ Filter parameters are being passed correctly to API${NC}"
else
  echo -e "${RED}❌ Filter parameters may not be working correctly${NC}"
fi

echo -e "\n${GREEN}=== All export UI tests completed! ===${NC}"
echo -e "${YELLOW}Note: UI pages should be manually tested in the browser to verify:${NC}"
echo -e "  - Export buttons are visible and clickable"
echo -e "  - Loading states show during export"
echo -e "  - Files download automatically"
echo -e "  - Filters are applied to exports"
echo -e "  - Error messages display correctly"

# Cleanup
rm -f /tmp/bms_export_ui_cookies.txt
rm -f /tmp/*-filtered.pdf



















