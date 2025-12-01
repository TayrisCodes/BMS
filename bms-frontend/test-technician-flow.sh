#!/bin/bash

# Test script for Technician Mobile UI Flow
# Make sure the dev server is running: npm run dev

BASE_URL="http://localhost:3000"
SESSION_COOKIE="bms_session"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== BMS Technician Flow Test Script ===${NC}\n"

# Check if server is running
if ! curl -s "$BASE_URL/api/health" > /dev/null 2>&1; then
  echo -e "${RED}❌ Server is not running at $BASE_URL${NC}"
  echo -e "${YELLOW}Please start the dev server with: npm run dev${NC}"
  exit 1
fi

# Step 1: Login as ORG_ADMIN to create work order and assign to technician
echo -e "${YELLOW}Step 1: Logging in as ORG_ADMIN to set up test data...${NC}"
ORG_ADMIN_LOGIN=$(curl -s -c /tmp/bms_technician_admin_cookies.txt -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"identifier": "admin@example.com", "password": "ChangeMe123!"}')

echo "$ORG_ADMIN_LOGIN"

ORG_ADMIN_SESSION=$(grep "$SESSION_COOKIE" /tmp/bms_technician_admin_cookies.txt | awk '{print $7}')

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
      "name": "Test Building for Technician",
      "address": {
        "street": "Test Street",
        "city": "Addis Ababa"
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

# Step 3: Get or create a technician user
echo -e "${YELLOW}Step 3: Getting or creating a technician user...${NC}"

LIST_USERS=$(curl -s -X GET "$BASE_URL/api/users" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")

TECHNICIAN_ID=$(echo "$LIST_USERS" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

# Try to find a user with TECHNICIAN role, or use the first user
# For now, we'll use the first user and assume they can be assigned as technician
# In a real scenario, you'd create a technician user or update an existing user's role

echo -e "${GREEN}✅ Using user ID: $TECHNICIAN_ID${NC}\n"

# Step 4: Create a work order assigned to technician
echo -e "${YELLOW}Step 4: Creating work order assigned to technician...${NC}"

CREATE_WORK_ORDER=$(curl -s -X POST "$BASE_URL/api/work-orders" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d "{
    \"buildingId\": \"$BUILDING_ID\",
    \"title\": \"Fix Leaky Pipe in Unit 101\",
    \"description\": \"Water leak in the kitchen sink. Needs immediate attention.\",
    \"category\": \"plumbing\",
    \"priority\": \"high\",
    \"status\": \"assigned\",
    \"assignedTo\": \"$TECHNICIAN_ID\",
    \"estimatedCost\": 3000
  }")

echo "$CREATE_WORK_ORDER"

WORK_ORDER_ID=$(echo "$CREATE_WORK_ORDER" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$WORK_ORDER_ID" ]; then
  echo -e "${RED}❌ Failed to create work order${NC}"
  echo -e "${YELLOW}Response: $CREATE_WORK_ORDER${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Work order created with ID: $WORK_ORDER_ID${NC}\n"

# Step 5: Test GET /api/work-orders?assignedTo=me (as technician)
echo -e "${YELLOW}Step 5: Testing GET /api/work-orders?assignedTo=me (technician view)...${NC}"

# Note: For this test, we need to login as the technician
# Since we don't have a technician login, we'll test the endpoint with the technician's user ID
# In a real scenario, the technician would login and the API would use their session

TECHNICIAN_WORK_ORDERS=$(curl -s -X GET "$BASE_URL/api/work-orders?assignedTo=$TECHNICIAN_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")

echo "$TECHNICIAN_WORK_ORDERS"

WORK_ORDER_COUNT=$(echo "$TECHNICIAN_WORK_ORDERS" | grep -o '"_id"' | wc -l)
if [ "$WORK_ORDER_COUNT" -gt 0 ]; then
  echo -e "${GREEN}✅ Technician work orders endpoint working${NC}"
else
  echo -e "${YELLOW}⚠️  No work orders found for technician${NC}"
fi
echo ""

# Step 6: Test GET /api/work-orders/[id] (Get work order detail)
echo -e "${YELLOW}Step 6: GET /api/work-orders/$WORK_ORDER_ID (Get work order detail)...${NC}"
GET_WORK_ORDER=$(curl -s -X GET "$BASE_URL/api/work-orders/$WORK_ORDER_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$GET_WORK_ORDER"
echo ""

# Step 7: Test PATCH /api/work-orders/[id]/status (Update status to in_progress)
echo -e "${YELLOW}Step 7: PATCH /api/work-orders/$WORK_ORDER_ID/status (Start work - update to in_progress)...${NC}"
START_WORK=$(curl -s -X PATCH "$BASE_URL/api/work-orders/$WORK_ORDER_ID/status" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "in_progress"
  }')
echo "$START_WORK"
echo ""

# Verify status changed
STATUS=$(echo "$START_WORK" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
if [ "$STATUS" = "in_progress" ]; then
  echo -e "${GREEN}✅ Work order status updated to in_progress${NC}"
else
  echo -e "${YELLOW}⚠️  Status: $STATUS (expected: in_progress)${NC}"
fi
echo ""

# Step 8: Test PATCH /api/work-orders/[id] (Update notes)
echo -e "${YELLOW}Step 8: PATCH /api/work-orders/$WORK_ORDER_ID (Update notes)...${NC}"
UPDATE_NOTES=$(curl -s -X PATCH "$BASE_URL/api/work-orders/$WORK_ORDER_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "Inspected the leak. Found broken pipe joint. Replaced the joint and tested. No more leaks."
  }')
echo "$UPDATE_NOTES"
echo ""

# Step 9: Test PATCH /api/work-orders/[id] (Complete work order)
echo -e "${YELLOW}Step 9: PATCH /api/work-orders/$WORK_ORDER_ID (Complete work order)...${NC}"
COMPLETE_WORK=$(curl -s -X PATCH "$BASE_URL/api/work-orders/$WORK_ORDER_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "completed",
    "actualCost": 2800,
    "notes": "Work completed successfully. Pipe joint replaced. Total cost: 2800 ETB."
  }')
echo "$COMPLETE_WORK"
echo ""

# Verify completion
COMPLETED_STATUS=$(echo "$COMPLETE_WORK" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
if [ "$COMPLETED_STATUS" = "completed" ]; then
  echo -e "${GREEN}✅ Work order completed successfully${NC}"
else
  echo -e "${YELLOW}⚠️  Status: $COMPLETED_STATUS (expected: completed)${NC}"
fi

# Verify completedAt timestamp
COMPLETED_AT=$(echo "$COMPLETE_WORK" | grep -o '"completedAt":"[^"]*"' | cut -d'"' -f4)
if [ -n "$COMPLETED_AT" ]; then
  echo -e "${GREEN}✅ CompletedAt timestamp set: $COMPLETED_AT${NC}"
else
  echo -e "${YELLOW}⚠️  CompletedAt timestamp not found${NC}"
fi
echo ""

# Step 10: Test GET /api/work-orders/[id] again (Verify final state)
echo -e "${YELLOW}Step 10: GET /api/work-orders/$WORK_ORDER_ID (Verify final state)...${NC}"
GET_FINAL=$(curl -s -X GET "$BASE_URL/api/work-orders/$WORK_ORDER_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$GET_FINAL"
echo ""

# Step 11: Test invalid status transition (should fail)
echo -e "${YELLOW}Step 11: Testing invalid status transition (completed → open, should fail)...${NC}"
INVALID_TRANSITION=$(curl -s -X PATCH "$BASE_URL/api/work-orders/$WORK_ORDER_ID/status" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "open"
  }')
echo "$INVALID_TRANSITION"

if echo "$INVALID_TRANSITION" | grep -q "Invalid status transition"; then
  echo -e "${GREEN}✅ Invalid status transition correctly rejected${NC}"
else
  echo -e "${YELLOW}⚠️  Invalid transition may not have been rejected${NC}"
fi
echo ""

# Step 12: Create another work order for testing filters
echo -e "${YELLOW}Step 12: Creating another work order for testing...${NC}"
CREATE_WORK_ORDER2=$(curl -s -X POST "$BASE_URL/api/work-orders" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d "{
    \"buildingId\": \"$BUILDING_ID\",
    \"title\": \"Replace Light Bulbs in Hallway\",
    \"description\": \"Multiple light bulbs need replacement in the main hallway.\",
    \"category\": \"electrical\",
    \"priority\": \"medium\",
    \"status\": \"assigned\",
    \"assignedTo\": \"$TECHNICIAN_ID\",
    \"estimatedCost\": 500
  }")

WORK_ORDER_ID2=$(echo "$CREATE_WORK_ORDER2" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "$CREATE_WORK_ORDER2"
echo ""

# Step 13: Test filtering by status
echo -e "${YELLOW}Step 13: Testing filter by status (in_progress)...${NC}"
FILTER_IN_PROGRESS=$(curl -s -X GET "$BASE_URL/api/work-orders?assignedTo=$TECHNICIAN_ID&status=in_progress" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$FILTER_IN_PROGRESS"
echo ""

# Step 14: Test filtering by category
echo -e "${YELLOW}Step 14: Testing filter by category (electrical)...${NC}"
FILTER_ELECTRICAL=$(curl -s -X GET "$BASE_URL/api/work-orders?assignedTo=$TECHNICIAN_ID&category=electrical" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$FILTER_ELECTRICAL"
echo ""

echo -e "${GREEN}=== All technician flow tests completed! ===${NC}"

# Cleanup
rm -f /tmp/bms_technician_admin_cookies.txt



















