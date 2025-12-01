#!/bin/bash

# Test script for Work Order Status Update API endpoint
# Make sure the dev server is running: npm run dev

BASE_URL="http://localhost:3000"
SESSION_COOKIE="bms_session"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Work Order Status Endpoint Test ===${NC}\n"

# Check if server is running
if ! curl -s "$BASE_URL/api/health" > /dev/null 2>&1; then
  echo -e "${RED}❌ Server is not running at $BASE_URL${NC}"
  echo -e "${YELLOW}Please start the dev server with: npm run dev${NC}"
  exit 1
fi

# Step 1: Login as ORG_ADMIN
echo -e "${YELLOW}Step 1: Logging in as ORG_ADMIN...${NC}"
ORG_ADMIN_LOGIN=$(curl -s -c /tmp/bms_status_test_cookies.txt -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"identifier": "admin@example.com", "password": "ChangeMe123!"}')

ORG_ADMIN_SESSION=$(grep "$SESSION_COOKIE" /tmp/bms_status_test_cookies.txt | awk '{print $7}')

if [ -z "$ORG_ADMIN_SESSION" ]; then
  echo -e "${RED}❌ Failed to get ORG_ADMIN session token${NC}"
  exit 1
fi

echo -e "${GREEN}✅ ORG_ADMIN session token obtained${NC}\n"

# Step 2: Get or create a building
echo -e "${YELLOW}Step 2: Getting a building...${NC}"
BUILDING_ID=$(curl -s -X GET "$BASE_URL/api/buildings?status=active" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$BUILDING_ID" ]; then
  echo -e "${RED}❌ Failed to get building${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Building ID: $BUILDING_ID${NC}\n"

# Step 3: Create a fresh work order for testing
echo -e "${YELLOW}Step 3: Creating fresh work order for status testing...${NC}"
CREATE_WO=$(curl -s -X POST "$BASE_URL/api/work-orders" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d "{
    \"buildingId\": \"$BUILDING_ID\",
    \"title\": \"Status Test Work Order\",
    \"description\": \"Testing status transitions\",
    \"category\": \"other\",
    \"priority\": \"medium\",
    \"status\": \"open\"
  }")

WO_ID=$(echo "$CREATE_WO" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$WO_ID" ]; then
  echo -e "${RED}❌ Failed to create work order${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Work order created: $WO_ID${NC}\n"

# Step 4: Test valid transition: open → assigned
echo -e "${YELLOW}Step 4: Testing transition: open → assigned...${NC}"
RESULT1=$(curl -s -X PATCH "$BASE_URL/api/work-orders/$WO_ID/status" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d '{"status": "assigned"}')

if echo "$RESULT1" | grep -q "successfully\|already set"; then
  echo -e "${GREEN}✅ SUCCESS${NC}"
  STATUS1=$(echo "$RESULT1" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
  echo "   Status: $STATUS1"
else
  echo -e "${RED}❌ FAILED${NC}"
  echo "$RESULT1"
fi
echo ""

# Step 5: Test valid transition: assigned → in_progress
echo -e "${YELLOW}Step 5: Testing transition: assigned → in_progress...${NC}"
RESULT2=$(curl -s -X PATCH "$BASE_URL/api/work-orders/$WO_ID/status" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d '{"status": "in_progress"}')

if echo "$RESULT2" | grep -q "successfully\|already set"; then
  echo -e "${GREEN}✅ SUCCESS${NC}"
  STATUS2=$(echo "$RESULT2" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
  echo "   Status: $STATUS2"
else
  echo -e "${RED}❌ FAILED${NC}"
  echo "$RESULT2"
fi
echo ""

# Step 6: Test valid transition: in_progress → completed
echo -e "${YELLOW}Step 6: Testing transition: in_progress → completed...${NC}"
RESULT3=$(curl -s -X PATCH "$BASE_URL/api/work-orders/$WO_ID/status" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d '{"status": "completed"}')

if echo "$RESULT3" | grep -q "successfully\|already set"; then
  echo -e "${GREEN}✅ SUCCESS${NC}"
  STATUS3=$(echo "$RESULT3" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
  COMPLETED_AT=$(echo "$RESULT3" | grep -o '"completedAt":"[^"]*"' | cut -d'"' -f4)
  echo "   Status: $STATUS3"
  echo "   CompletedAt: $COMPLETED_AT"
else
  echo -e "${RED}❌ FAILED${NC}"
  echo "$RESULT3"
fi
echo ""

# Step 7: Test invalid transition: completed → in_progress (should fail with 400)
echo -e "${YELLOW}Step 7: Testing invalid transition: completed → in_progress (should fail)...${NC}"
RESULT4=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X PATCH "$BASE_URL/api/work-orders/$WO_ID/status" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d '{"status": "in_progress"}')

HTTP_STATUS=$(echo "$RESULT4" | grep "HTTP_STATUS" | cut -d':' -f2)
BODY=$(echo "$RESULT4" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS" = "400" ] && echo "$BODY" | grep -q "Invalid status transition"; then
  echo -e "${GREEN}✅ CORRECTLY REJECTED (400)${NC}"
  echo "   Error: $(echo "$BODY" | grep -o '"error":"[^"]*"' | cut -d'"' -f4)"
else
  echo -e "${RED}❌ UNEXPECTED RESULT${NC}"
  echo "   HTTP Status: $HTTP_STATUS"
  echo "   Response: $BODY"
fi
echo ""

# Step 8: Test idempotent update (same status)
echo -e "${YELLOW}Step 8: Testing idempotent update (completed → completed)...${NC}"
RESULT5=$(curl -s -X PATCH "$BASE_URL/api/work-orders/$WO_ID/status" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d '{"status": "completed"}')

if echo "$RESULT5" | grep -q "already set\|successfully"; then
  echo -e "${GREEN}✅ SUCCESS (idempotent)${NC}"
else
  echo -e "${YELLOW}⚠️  Response: $RESULT5${NC}"
fi
echo ""

# Step 9: Test missing status field (should fail with 400)
echo -e "${YELLOW}Step 9: Testing missing status field (should fail)...${NC}"
RESULT6=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X PATCH "$BASE_URL/api/work-orders/$WO_ID/status" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d '{}')

HTTP_STATUS=$(echo "$RESULT6" | grep "HTTP_STATUS" | cut -d':' -f2)
BODY=$(echo "$RESULT6" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS" = "400" ] && echo "$BODY" | grep -q "Status is required"; then
  echo -e "${GREEN}✅ CORRECTLY REJECTED (400)${NC}"
else
  echo -e "${RED}❌ UNEXPECTED RESULT${NC}"
  echo "   HTTP Status: $HTTP_STATUS"
  echo "   Response: $BODY"
fi
echo ""

# Step 10: Create another work order and test cancelled transition
echo -e "${YELLOW}Step 10: Creating work order to test cancelled transition...${NC}"
CREATE_WO2=$(curl -s -X POST "$BASE_URL/api/work-orders" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d "{
    \"buildingId\": \"$BUILDING_ID\",
    \"title\": \"Cancellation Test\",
    \"description\": \"Testing cancellation\",
    \"category\": \"other\",
    \"priority\": \"low\",
    \"status\": \"open\"
  }")

WO_ID2=$(echo "$CREATE_WO2" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo -e "${GREEN}✅ Work order created: $WO_ID2${NC}"

echo -e "${YELLOW}Step 10b: Testing transition: open → cancelled...${NC}"
RESULT7=$(curl -s -X PATCH "$BASE_URL/api/work-orders/$WO_ID2/status" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d '{"status": "cancelled"}')

if echo "$RESULT7" | grep -q "successfully\|already set"; then
  echo -e "${GREEN}✅ SUCCESS${NC}"
  STATUS7=$(echo "$RESULT7" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
  echo "   Status: $STATUS7"
else
  echo -e "${RED}❌ FAILED${NC}"
  echo "$RESULT7"
fi
echo ""

echo -e "${YELLOW}Step 10c: Testing invalid transition: cancelled → open (should fail)...${NC}"
RESULT8=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X PATCH "$BASE_URL/api/work-orders/$WO_ID2/status" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d '{"status": "open"}')

HTTP_STATUS=$(echo "$RESULT8" | grep "HTTP_STATUS" | cut -d':' -f2)
BODY=$(echo "$RESULT8" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS" = "400" ] && echo "$BODY" | grep -q "Invalid status transition"; then
  echo -e "${GREEN}✅ CORRECTLY REJECTED (400)${NC}"
else
  echo -e "${RED}❌ UNEXPECTED RESULT${NC}"
  echo "   HTTP Status: $HTTP_STATUS"
  echo "   Response: $BODY"
fi
echo ""

echo -e "${GREEN}=== All status endpoint tests completed! ===${NC}"

# Cleanup
rm -f /tmp/bms_status_test_cookies.txt



















