#!/bin/bash

# Test script for Work Orders CRUD API endpoints
# Make sure the dev server is running: npm run dev

BASE_URL="http://localhost:3000"
SESSION_COOKIE="bms_session"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== BMS Work Orders API Test Script ===${NC}\n"

# Check if server is running
if ! curl -s "$BASE_URL/api/health" > /dev/null 2>&1; then
  echo -e "${RED}❌ Server is not running at $BASE_URL${NC}"
  echo -e "${YELLOW}Please start the dev server with: npm run dev${NC}"
  exit 1
fi

# Step 1: Login as ORG_ADMIN
echo -e "${YELLOW}Step 1: Logging in as ORG_ADMIN...${NC}"
ORG_ADMIN_LOGIN=$(curl -s -c /tmp/bms_work_orders_cookies.txt -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"identifier": "admin@example.com", "password": "ChangeMe123!"}')

echo "$ORG_ADMIN_LOGIN"

ORG_ADMIN_SESSION=$(grep "$SESSION_COOKIE" /tmp/bms_work_orders_cookies.txt | awk '{print $7}')

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
      "name": "Test Building for Work Orders",
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

# Step 3: Get or create a complaint (optional, for linking)
echo -e "${YELLOW}Step 3: Getting or creating a complaint (optional)...${NC}"

LIST_COMPLAINTS=$(curl -s -X GET "$BASE_URL/api/complaints?status=open" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")

COMPLAINT_ID=$(echo "$LIST_COMPLAINTS" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)

echo -e "${GREEN}✅ Complaint ID: $COMPLAINT_ID${NC}\n"

# Step 4: Test GET /api/work-orders (List work orders - should be empty initially)
echo -e "${YELLOW}Step 4: GET /api/work-orders (List work orders)...${NC}"
LIST_WORK_ORDERS=$(curl -s -X GET "$BASE_URL/api/work-orders" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$LIST_WORK_ORDERS"
echo ""

# Step 5: Test POST /api/work-orders (Create work order)
echo -e "${YELLOW}Step 5: POST /api/work-orders (Create work order)...${NC}"

CREATE_WORK_ORDER=$(curl -s -X POST "$BASE_URL/api/work-orders" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d "{
    \"buildingId\": \"$BUILDING_ID\",
    \"complaintId\": \"$COMPLAINT_ID\",
    \"title\": \"Fix Broken AC Unit\",
    \"description\": \"The air conditioning unit in unit 101 is not working. Needs immediate repair.\",
    \"category\": \"hvac\",
    \"priority\": \"high\",
    \"status\": \"open\",
    \"estimatedCost\": 5000
  }")

echo "$CREATE_WORK_ORDER"

WORK_ORDER_ID=$(echo "$CREATE_WORK_ORDER" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$WORK_ORDER_ID" ]; then
  echo -e "${RED}❌ Failed to create work order${NC}"
  echo -e "${YELLOW}Response: $CREATE_WORK_ORDER${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Work order created with ID: $WORK_ORDER_ID${NC}\n"

# Step 6: Test GET /api/work-orders/[id] (Get single work order)
echo -e "${YELLOW}Step 6: GET /api/work-orders/$WORK_ORDER_ID (Get single work order)...${NC}"
GET_WORK_ORDER=$(curl -s -X GET "$BASE_URL/api/work-orders/$WORK_ORDER_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$GET_WORK_ORDER"
echo ""

# Step 7: Test GET /api/work-orders with filters
echo -e "${YELLOW}Step 7: GET /api/work-orders?buildingId=$BUILDING_ID (Filter by building)...${NC}"
FILTER_BY_BUILDING=$(curl -s -X GET "$BASE_URL/api/work-orders?buildingId=$BUILDING_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$FILTER_BY_BUILDING"
echo ""

echo -e "${YELLOW}Step 7b: GET /api/work-orders?status=open (Filter by status)...${NC}"
FILTER_BY_STATUS=$(curl -s -X GET "$BASE_URL/api/work-orders?status=open" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$FILTER_BY_STATUS"
echo ""

echo -e "${YELLOW}Step 7c: GET /api/work-orders?priority=high (Filter by priority)...${NC}"
FILTER_BY_PRIORITY=$(curl -s -X GET "$BASE_URL/api/work-orders?priority=high" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$FILTER_BY_PRIORITY"
echo ""

echo -e "${YELLOW}Step 7d: GET /api/work-orders?category=hvac (Filter by category)...${NC}"
FILTER_BY_CATEGORY=$(curl -s -X GET "$BASE_URL/api/work-orders?category=hvac" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$FILTER_BY_CATEGORY"
echo ""

# Step 8: Test PATCH /api/work-orders/[id] (Assign work order)
echo -e "${YELLOW}Step 8: PATCH /api/work-orders/$WORK_ORDER_ID (Assign work order)...${NC}"
ASSIGN_WORK_ORDER=$(curl -s -X PATCH "$BASE_URL/api/work-orders/$WORK_ORDER_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "assigned",
    "assignedTo": "507f1f77bcf86cd799439011"
  }')
echo "$ASSIGN_WORK_ORDER"
echo ""

# Step 9: Test PATCH /api/work-orders/[id] (Update status to in_progress)
echo -e "${YELLOW}Step 9: PATCH /api/work-orders/$WORK_ORDER_ID (Update status to in_progress)...${NC}"
UPDATE_STATUS=$(curl -s -X PATCH "$BASE_URL/api/work-orders/$WORK_ORDER_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "in_progress"
  }')
echo "$UPDATE_STATUS"
echo ""

# Step 10: Test GET /api/work-orders/[id] again (Verify status change)
echo -e "${YELLOW}Step 10: GET /api/work-orders/$WORK_ORDER_ID (Verify status change)...${NC}"
GET_UPDATED=$(curl -s -X GET "$BASE_URL/api/work-orders/$WORK_ORDER_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$GET_UPDATED"

STATUS=$(echo "$GET_UPDATED" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
if [ "$STATUS" = "in_progress" ]; then
  echo -e "${GREEN}✅ Work order status updated to in_progress${NC}"
fi
echo ""

# Step 11: Test PATCH /api/work-orders/[id] (Complete work order)
echo -e "${YELLOW}Step 11: PATCH /api/work-orders/$WORK_ORDER_ID (Complete work order)...${NC}"
COMPLETE_WORK_ORDER=$(curl -s -X PATCH "$BASE_URL/api/work-orders/$WORK_ORDER_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "completed",
    "actualCost": 4500,
    "notes": "AC unit repaired. Replaced compressor and refilled refrigerant. System is now working properly."
  }')
echo "$COMPLETE_WORK_ORDER"
echo ""

# Step 12: Test GET /api/work-orders/[id] again (Verify completion)
echo -e "${YELLOW}Step 12: GET /api/work-orders/$WORK_ORDER_ID (Verify completion)...${NC}"
GET_COMPLETED=$(curl -s -X GET "$BASE_URL/api/work-orders/$WORK_ORDER_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$GET_COMPLETED"

COMPLETED_STATUS=$(echo "$GET_COMPLETED" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
if [ "$COMPLETED_STATUS" = "completed" ]; then
  echo -e "${GREEN}✅ Work order completed successfully${NC}"
fi
echo ""

# Step 13: Create another work order for more testing
echo -e "${YELLOW}Step 13: POST /api/work-orders (Create another work order - plumbing)...${NC}"
CREATE_WORK_ORDER2=$(curl -s -X POST "$BASE_URL/api/work-orders" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d "{
    \"buildingId\": \"$BUILDING_ID\",
    \"title\": \"Fix Leaky Faucet\",
    \"description\": \"Kitchen faucet in unit 205 is leaking. Needs repair.\",
    \"category\": \"plumbing\",
    \"priority\": \"medium\",
    \"status\": \"open\",
    \"estimatedCost\": 2000
  }")

WORK_ORDER_ID2=$(echo "$CREATE_WORK_ORDER2" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "$CREATE_WORK_ORDER2"
echo ""

# Step 14: Test PATCH /api/work-orders/[id] (Update work order details)
echo -e "${YELLOW}Step 14: PATCH /api/work-orders/$WORK_ORDER_ID2 (Update work order details)...${NC}"
UPDATE_WORK_ORDER=$(curl -s -X PATCH "$BASE_URL/api/work-orders/$WORK_ORDER_ID2" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Fix Leaky Faucet - Updated",
    "description": "Kitchen faucet in unit 205 is leaking badly. Needs immediate repair.",
    "priority": "high"
  }')
echo "$UPDATE_WORK_ORDER"
echo ""

# Step 15: Test DELETE /api/work-orders/[id] (Cancel work order)
echo -e "${YELLOW}Step 15: DELETE /api/work-orders/$WORK_ORDER_ID2 (Cancel work order)...${NC}"
CANCEL_WORK_ORDER=$(curl -s -X DELETE "$BASE_URL/api/work-orders/$WORK_ORDER_ID2" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$CANCEL_WORK_ORDER"
echo ""

# Step 16: Test GET /api/work-orders/[id] again (Verify cancellation)
echo -e "${YELLOW}Step 16: GET /api/work-orders/$WORK_ORDER_ID2 (Verify cancellation)...${NC}"
GET_CANCELLED=$(curl -s -X GET "$BASE_URL/api/work-orders/$WORK_ORDER_ID2" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$GET_CANCELLED"

CANCELLED_STATUS=$(echo "$GET_CANCELLED" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
if [ "$CANCELLED_STATUS" = "cancelled" ]; then
  echo -e "${GREEN}✅ Work order cancelled successfully${NC}"
fi
echo ""

# Step 17: Test GET /api/work-orders (List all work orders)
echo -e "${YELLOW}Step 17: GET /api/work-orders (List all work orders)...${NC}"
LIST_ALL=$(curl -s -X GET "$BASE_URL/api/work-orders" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$LIST_ALL"
echo ""

echo -e "${GREEN}=== All work orders API tests completed! ===${NC}"

# Cleanup
rm -f /tmp/bms_work_orders_cookies.txt



















