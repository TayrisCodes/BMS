#!/bin/bash

# Test script for CSV and PDF Export Functionality (Step 5 & 6 - Phase 6)
# Make sure the dev server is running: npm run dev

BASE_URL="http://localhost:3000"
SESSION_COOKIE="bms_session"
TEST_DIR="/tmp/bms_export_tests"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== BMS Reports Export Test Script (CSV & PDF) ===${NC}\n"

# Create test directory
mkdir -p "$TEST_DIR"
echo -e "${YELLOW}Test files will be saved to: $TEST_DIR${NC}\n"

# Check if server is running
if ! curl -s "$BASE_URL/api/health" > /dev/null 2>&1; then
  echo -e "${RED}❌ Server is not running at $BASE_URL${NC}"
  echo -e "${YELLOW}Please start the dev server with: npm run dev${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Server is running${NC}\n"

# Step 1: Login as ORG_ADMIN
echo -e "${YELLOW}Step 1: Logging in as ORG_ADMIN...${NC}"
ORG_ADMIN_LOGIN=$(curl -s -c /tmp/bms_export_cookies.txt -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"identifier": "admin@example.com", "password": "ChangeMe123!"}')

ORG_ADMIN_SESSION=$(grep "$SESSION_COOKIE" /tmp/bms_export_cookies.txt | awk '{print $7}')

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

# Test CSV Exports
echo -e "${BLUE}=== Testing CSV Exports ===${NC}\n"

# Test 1: Financial CSV Export (no filters)
echo -e "${YELLOW}Test 1.1: Financial CSV Export (no filters)...${NC}"
FINANCIAL_CSV=$(curl -s -X GET "$BASE_URL/api/reports/financial/export/csv" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -w "\n%{http_code}")

HTTP_CODE=$(echo "$FINANCIAL_CSV" | tail -1)
CSV_CONTENT=$(echo "$FINANCIAL_CSV" | head -n -1)

if [ "$HTTP_CODE" = "200" ] && echo "$CSV_CONTENT" | grep -q "Financial Report"; then
  echo "$CSV_CONTENT" > "$TEST_DIR/financial-report-all.csv"
  echo -e "${GREEN}✅ Financial CSV export successful (saved to $TEST_DIR/financial-report-all.csv)${NC}"
  echo -e "   File size: $(wc -c < "$TEST_DIR/financial-report-all.csv") bytes"
else
  echo -e "${RED}❌ Financial CSV export failed (HTTP $HTTP_CODE)${NC}"
fi

# Test 1.2: Financial CSV Export (with date range)
echo -e "\n${YELLOW}Test 1.2: Financial CSV Export (with date range)...${NC}"
FINANCIAL_CSV_RANGE=$(curl -s -X GET "$BASE_URL/api/reports/financial/export/csv?startDate=$START_DATE&endDate=$END_DATE" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -w "\n%{http_code}")

HTTP_CODE=$(echo "$FINANCIAL_CSV_RANGE" | tail -1)
CSV_CONTENT=$(echo "$FINANCIAL_CSV_RANGE" | head -n -1)

if [ "$HTTP_CODE" = "200" ] && echo "$CSV_CONTENT" | grep -q "Financial Report"; then
  echo "$CSV_CONTENT" > "$TEST_DIR/financial-report-daterange.csv"
  echo -e "${GREEN}✅ Financial CSV export with date range successful${NC}"
  echo -e "   File size: $(wc -c < "$TEST_DIR/financial-report-daterange.csv") bytes"
else
  echo -e "${RED}❌ Financial CSV export with date range failed (HTTP $HTTP_CODE)${NC}"
fi

# Test 2: Occupancy CSV Export
echo -e "\n${YELLOW}Test 2: Occupancy CSV Export...${NC}"
OCCUPANCY_CSV=$(curl -s -X GET "$BASE_URL/api/reports/occupancy/export/csv" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -w "\n%{http_code}")

HTTP_CODE=$(echo "$OCCUPANCY_CSV" | tail -1)
CSV_CONTENT=$(echo "$OCCUPANCY_CSV" | head -n -1)

if [ "$HTTP_CODE" = "200" ] && echo "$CSV_CONTENT" | grep -q "Occupancy Report"; then
  echo "$CSV_CONTENT" > "$TEST_DIR/occupancy-report.csv"
  echo -e "${GREEN}✅ Occupancy CSV export successful (saved to $TEST_DIR/occupancy-report.csv)${NC}"
  echo -e "   File size: $(wc -c < "$TEST_DIR/occupancy-report.csv") bytes"
else
  echo -e "${RED}❌ Occupancy CSV export failed (HTTP $HTTP_CODE)${NC}"
fi

# Test 3: Operational CSV Export
echo -e "\n${YELLOW}Test 3: Operational CSV Export...${NC}"
OPERATIONAL_CSV=$(curl -s -X GET "$BASE_URL/api/reports/operational/export/csv?startDate=$START_DATE&endDate=$END_DATE" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -w "\n%{http_code}")

HTTP_CODE=$(echo "$OPERATIONAL_CSV" | tail -1)
CSV_CONTENT=$(echo "$OPERATIONAL_CSV" | head -n -1)

if [ "$HTTP_CODE" = "200" ] && echo "$CSV_CONTENT" | grep -q "Operational Report"; then
  echo "$CSV_CONTENT" > "$TEST_DIR/operational-report.csv"
  echo -e "${GREEN}✅ Operational CSV export successful (saved to $TEST_DIR/operational-report.csv)${NC}"
  echo -e "   File size: $(wc -c < "$TEST_DIR/operational-report.csv") bytes"
else
  echo -e "${RED}❌ Operational CSV export failed (HTTP $HTTP_CODE)${NC}"
fi

# Test PDF Exports
echo -e "\n${BLUE}=== Testing PDF Exports ===${NC}\n"

# Test 4: Financial PDF Export
echo -e "${YELLOW}Test 4.1: Financial PDF Export (no filters)...${NC}"
FINANCIAL_PDF=$(curl -s -X GET "$BASE_URL/api/reports/financial/export/pdf" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -w "\n%{http_code}" \
  -o "$TEST_DIR/financial-report-all.pdf")

HTTP_CODE=$(echo "$FINANCIAL_PDF" | tail -1)

if [ "$HTTP_CODE" = "200" ] && [ -f "$TEST_DIR/financial-report-all.pdf" ]; then
  PDF_SIZE=$(wc -c < "$TEST_DIR/financial-report-all.pdf")
  if [ "$PDF_SIZE" -gt 1000 ]; then
    echo -e "${GREEN}✅ Financial PDF export successful (saved to $TEST_DIR/financial-report-all.pdf)${NC}"
    echo -e "   File size: $PDF_SIZE bytes"
    if command -v file > /dev/null 2>&1; then
      FILE_TYPE=$(file "$TEST_DIR/financial-report-all.pdf" | grep -o "PDF")
      if [ -n "$FILE_TYPE" ]; then
        echo -e "   File type: Valid PDF"
      fi
    fi
  else
    echo -e "${RED}❌ Financial PDF export failed (file too small: $PDF_SIZE bytes)${NC}"
  fi
else
  echo -e "${RED}❌ Financial PDF export failed (HTTP $HTTP_CODE)${NC}"
fi

# Test 4.2: Financial PDF Export (with date range)
echo -e "\n${YELLOW}Test 4.2: Financial PDF Export (with date range)...${NC}"
FINANCIAL_PDF_RANGE=$(curl -s -X GET "$BASE_URL/api/reports/financial/export/pdf?startDate=$START_DATE&endDate=$END_DATE" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -w "\n%{http_code}" \
  -o "$TEST_DIR/financial-report-daterange.pdf")

HTTP_CODE=$(echo "$FINANCIAL_PDF_RANGE" | tail -1)

if [ "$HTTP_CODE" = "200" ] && [ -f "$TEST_DIR/financial-report-daterange.pdf" ]; then
  PDF_SIZE=$(wc -c < "$TEST_DIR/financial-report-daterange.pdf")
  if [ "$PDF_SIZE" -gt 1000 ]; then
    echo -e "${GREEN}✅ Financial PDF export with date range successful${NC}"
    echo -e "   File size: $PDF_SIZE bytes"
  else
    echo -e "${RED}❌ Financial PDF export with date range failed (file too small)${NC}"
  fi
else
  echo -e "${RED}❌ Financial PDF export with date range failed (HTTP $HTTP_CODE)${NC}"
fi

# Test 5: Occupancy PDF Export
echo -e "\n${YELLOW}Test 5: Occupancy PDF Export...${NC}"
OCCUPANCY_PDF=$(curl -s -X GET "$BASE_URL/api/reports/occupancy/export/pdf" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -w "\n%{http_code}" \
  -o "$TEST_DIR/occupancy-report.pdf")

HTTP_CODE=$(echo "$OCCUPANCY_PDF" | tail -1)

if [ "$HTTP_CODE" = "200" ] && [ -f "$TEST_DIR/occupancy-report.pdf" ]; then
  PDF_SIZE=$(wc -c < "$TEST_DIR/occupancy-report.pdf")
  if [ "$PDF_SIZE" -gt 1000 ]; then
    echo -e "${GREEN}✅ Occupancy PDF export successful (saved to $TEST_DIR/occupancy-report.pdf)${NC}"
    echo -e "   File size: $PDF_SIZE bytes"
    if command -v file > /dev/null 2>&1; then
      FILE_TYPE=$(file "$TEST_DIR/occupancy-report.pdf" | grep -o "PDF")
      if [ -n "$FILE_TYPE" ]; then
        echo -e "   File type: Valid PDF"
      fi
    fi
  else
    echo -e "${RED}❌ Occupancy PDF export failed (file too small: $PDF_SIZE bytes)${NC}"
  fi
else
  echo -e "${RED}❌ Occupancy PDF export failed (HTTP $HTTP_CODE)${NC}"
fi

# Test 6: Operational PDF Export
echo -e "\n${YELLOW}Test 6: Operational PDF Export...${NC}"
OPERATIONAL_PDF=$(curl -s -X GET "$BASE_URL/api/reports/operational/export/pdf?startDate=$START_DATE&endDate=$END_DATE" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -w "\n%{http_code}" \
  -o "$TEST_DIR/operational-report.pdf")

HTTP_CODE=$(echo "$OPERATIONAL_PDF" | tail -1)

if [ "$HTTP_CODE" = "200" ] && [ -f "$TEST_DIR/operational-report.pdf" ]; then
  PDF_SIZE=$(wc -c < "$TEST_DIR/operational-report.pdf")
  if [ "$PDF_SIZE" -gt 1000 ]; then
    echo -e "${GREEN}✅ Operational PDF export successful (saved to $TEST_DIR/operational-report.pdf)${NC}"
    echo -e "   File size: $PDF_SIZE bytes"
    if command -v file > /dev/null 2>&1; then
      FILE_TYPE=$(file "$TEST_DIR/operational-report.pdf" | grep -o "PDF")
      if [ -n "$FILE_TYPE" ]; then
        echo -e "   File type: Valid PDF"
      fi
    fi
  else
    echo -e "${RED}❌ Operational PDF export failed (file too small: $PDF_SIZE bytes)${NC}"
  fi
else
  echo -e "${RED}❌ Operational PDF export failed (HTTP $HTTP_CODE)${NC}"
fi

# Test Content-Type headers
echo -e "\n${BLUE}=== Testing Content-Type Headers ===${NC}\n"

echo -e "${YELLOW}Testing CSV Content-Type...${NC}"
CSV_HEADERS=$(curl -s -I -X GET "$BASE_URL/api/reports/financial/export/csv" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")

if echo "$CSV_HEADERS" | grep -qi "content-type:.*text/csv"; then
  echo -e "${GREEN}✅ CSV Content-Type header is correct${NC}"
else
  echo -e "${RED}❌ CSV Content-Type header is incorrect${NC}"
  echo "$CSV_HEADERS" | grep -i "content-type"
fi

echo -e "\n${YELLOW}Testing PDF Content-Type...${NC}"
PDF_HEADERS=$(curl -s -I -X GET "$BASE_URL/api/reports/financial/export/pdf" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")

if echo "$PDF_HEADERS" | grep -qi "content-type:.*application/pdf"; then
  echo -e "${GREEN}✅ PDF Content-Type header is correct${NC}"
else
  echo -e "${RED}❌ PDF Content-Type header is incorrect${NC}"
  echo "$PDF_HEADERS" | grep -i "content-type"
fi

# Summary
echo -e "\n${BLUE}=== Test Summary ===${NC}\n"
echo -e "${YELLOW}Test files saved in: $TEST_DIR${NC}"
echo -e "${YELLOW}Files created:${NC}"
ls -lh "$TEST_DIR" 2>/dev/null | tail -n +2 | awk '{print "   - " $9 " (" $5 ")"}'

echo -e "\n${GREEN}=== All export tests completed! ===${NC}"

# Cleanup
rm -f /tmp/bms_export_cookies.txt



















