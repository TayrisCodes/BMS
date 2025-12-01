#!/bin/bash

# Test script for Complaint CRUD API endpoints
# Make sure the dev server is running: npm run dev

BASE_URL="http://localhost:3000"
SESSION_COOKIE="bms_session"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== BMS Complaint API Test Script ===${NC}\n"

# Check if server is running
if ! curl -s "$BASE_URL/api/health" > /dev/null 2>&1; then
  echo -e "${RED}❌ Server is not running at $BASE_URL${NC}"
  echo -e "${YELLOW}Please start the dev server with: npm run dev${NC}"
  exit 1
fi

# Step 1: Login as ORG_ADMIN
echo -e "${YELLOW}Step 1: Logging in as ORG_ADMIN...${NC}"
ORG_ADMIN_LOGIN=$(curl -s -c /tmp/bms_complaints_cookies.txt -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"identifier": "admin@example.com", "password": "ChangeMe123!"}')

echo "$ORG_ADMIN_LOGIN"

ORG_ADMIN_SESSION=$(grep "$SESSION_COOKIE" /tmp/bms_complaints_cookies.txt | awk '{print $7}')

if [ -z "$ORG_ADMIN_SESSION" ]; then
  echo -e "${RED}❌ Failed to get ORG_ADMIN session token${NC}"
  exit 1
fi

echo -e "${GREEN}✅ ORG_ADMIN session token obtained${NC}\n"

# Step 2: Get or create a tenant for complaints
echo -e "${YELLOW}Step 2: Getting or creating a tenant...${NC}"

LIST_TENANTS=$(curl -s -X GET "$BASE_URL/api/tenants?status=active" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")

TENANT_ID=$(echo "$LIST_TENANTS" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$TENANT_ID" ]; then
  CREATE_TENANT=$(curl -s -X POST "$BASE_URL/api/tenants" \
    -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
    -H "Content-Type: application/json" \
    -d '{
      "firstName": "Complaint",
      "lastName": "Test",
      "primaryPhone": "+251912345679",
      "status": "active"
    }')
  TENANT_ID=$(echo "$CREATE_TENANT" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
fi

if [ -z "$TENANT_ID" ]; then
  echo -e "${RED}❌ Failed to get or create tenant${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Tenant ID: $TENANT_ID${NC}\n"

# Step 3: Get or create a unit (optional for complaints)
echo -e "${YELLOW}Step 3: Getting or creating a unit (optional)...${NC}"

LIST_UNITS=$(curl -s -X GET "$BASE_URL/api/units?status=available" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")

UNIT_ID=$(echo "$LIST_UNITS" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)

echo -e "${GREEN}✅ Unit ID: $UNIT_ID${NC}\n"

# Step 4: Test GET /api/complaints (List complaints - should be empty initially)
echo -e "${YELLOW}Step 4: GET /api/complaints (List complaints)...${NC}"
LIST_COMPLAINTS=$(curl -s -X GET "$BASE_URL/api/complaints" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$LIST_COMPLAINTS"
echo ""

# Step 5: Test POST /api/complaints (Create complaint)
echo -e "${YELLOW}Step 5: POST /api/complaints (Create complaint)...${NC}"

CREATE_COMPLAINT=$(curl -s -X POST "$BASE_URL/api/complaints" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d "{
    \"tenantId\": \"$TENANT_ID\",
    \"unitId\": \"$UNIT_ID\",
    \"category\": \"maintenance\",
    \"title\": \"Broken AC Unit\",
    \"description\": \"The air conditioning unit in the living room is not working properly. It makes strange noises and doesn't cool the room.\",
    \"priority\": \"high\",
    \"status\": \"open\"
  }")

echo "$CREATE_COMPLAINT"

COMPLAINT_ID=$(echo "$CREATE_COMPLAINT" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$COMPLAINT_ID" ]; then
  echo -e "${RED}❌ Failed to create complaint${NC}"
  echo -e "${YELLOW}Response: $CREATE_COMPLAINT${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Complaint created with ID: $COMPLAINT_ID${NC}\n"

# Step 6: Test GET /api/complaints/[id] (Get single complaint)
echo -e "${YELLOW}Step 6: GET /api/complaints/$COMPLAINT_ID (Get single complaint)...${NC}"
GET_COMPLAINT=$(curl -s -X GET "$BASE_URL/api/complaints/$COMPLAINT_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$GET_COMPLAINT"
echo ""

# Step 7: Test GET /api/complaints with filters
echo -e "${YELLOW}Step 7: GET /api/complaints?tenantId=$TENANT_ID (Filter by tenant)...${NC}"
FILTER_BY_TENANT=$(curl -s -X GET "$BASE_URL/api/complaints?tenantId=$TENANT_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$FILTER_BY_TENANT"
echo ""

echo -e "${YELLOW}Step 7b: GET /api/complaints?status=open (Filter by status)...${NC}"
FILTER_BY_STATUS=$(curl -s -X GET "$BASE_URL/api/complaints?status=open" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$FILTER_BY_STATUS"
echo ""

echo -e "${YELLOW}Step 7c: GET /api/complaints?priority=high (Filter by priority)...${NC}"
FILTER_BY_PRIORITY=$(curl -s -X GET "$BASE_URL/api/complaints?priority=high" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$FILTER_BY_PRIORITY"
echo ""

# Step 8: Test PATCH /api/complaints/[id] (Assign complaint)
echo -e "${YELLOW}Step 8: PATCH /api/complaints/$COMPLAINT_ID (Assign complaint)...${NC}"
ASSIGN_COMPLAINT=$(curl -s -X PATCH "$BASE_URL/api/complaints/$COMPLAINT_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "assigned",
    "assignedTo": "507f1f77bcf86cd799439011"
  }')
echo "$ASSIGN_COMPLAINT"
echo ""

# Step 9: Test PATCH /api/complaints/[id] (Update status to in_progress)
echo -e "${YELLOW}Step 9: PATCH /api/complaints/$COMPLAINT_ID (Update status to in_progress)...${NC}"
UPDATE_STATUS=$(curl -s -X PATCH "$BASE_URL/api/complaints/$COMPLAINT_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "in_progress"
  }')
echo "$UPDATE_STATUS"
echo ""

# Step 10: Test GET /api/complaints/[id] again (Verify status change)
echo -e "${YELLOW}Step 10: GET /api/complaints/$COMPLAINT_ID (Verify status change)...${NC}"
GET_UPDATED=$(curl -s -X GET "$BASE_URL/api/complaints/$COMPLAINT_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$GET_UPDATED"

STATUS=$(echo "$GET_UPDATED" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
if [ "$STATUS" = "in_progress" ]; then
  echo -e "${GREEN}✅ Complaint status updated to in_progress${NC}"
fi
echo ""

# Step 11: Test PATCH /api/complaints/[id] (Resolve complaint with notes)
echo -e "${YELLOW}Step 11: PATCH /api/complaints/$COMPLAINT_ID (Resolve complaint with notes)...${NC}"
RESOLVE_COMPLAINT=$(curl -s -X PATCH "$BASE_URL/api/complaints/$COMPLAINT_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "resolved",
    "resolutionNotes": "AC unit repaired. Replaced compressor and refilled refrigerant. System is now working properly."
  }')
echo "$RESOLVE_COMPLAINT"
echo ""

# Step 12: Test GET /api/complaints/[id] again (Verify resolution)
echo -e "${YELLOW}Step 12: GET /api/complaints/$COMPLAINT_ID (Verify resolution)...${NC}"
GET_RESOLVED=$(curl -s -X GET "$BASE_URL/api/complaints/$COMPLAINT_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$GET_RESOLVED"

RESOLVED_STATUS=$(echo "$GET_RESOLVED" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
if [ "$RESOLVED_STATUS" = "resolved" ]; then
  echo -e "${GREEN}✅ Complaint resolved successfully${NC}"
fi
echo ""

# Step 13: Create another complaint for more testing
echo -e "${YELLOW}Step 13: POST /api/complaints (Create another complaint - noise)...${NC}"
CREATE_COMPLAINT2=$(curl -s -X POST "$BASE_URL/api/complaints" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d "{
    \"tenantId\": \"$TENANT_ID\",
    \"category\": \"noise\",
    \"title\": \"Noisy Neighbors\",
    \"description\": \"Loud music coming from apartment above during late hours.\",
    \"priority\": \"medium\",
    \"status\": \"open\"
  }")

COMPLAINT_ID2=$(echo "$CREATE_COMPLAINT2" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "$CREATE_COMPLAINT2"
echo ""

# Step 14: Test PATCH /api/complaints/[id] (Update complaint details)
echo -e "${YELLOW}Step 14: PATCH /api/complaints/$COMPLAINT_ID2 (Update complaint details)...${NC}"
UPDATE_COMPLAINT=$(curl -s -X PATCH "$BASE_URL/api/complaints/$COMPLAINT_ID2" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Noisy Neighbors - Updated",
    "description": "Loud music and parties coming from apartment above during late hours (10 PM - 2 AM).",
    "priority": "urgent"
  }')
echo "$UPDATE_COMPLAINT"
echo ""

# Step 15: Test GET /api/complaints?category=noise (Filter by category)
echo -e "${YELLOW}Step 15: GET /api/complaints (List all complaints)...${NC}"
LIST_ALL=$(curl -s -X GET "$BASE_URL/api/complaints" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$LIST_ALL"
echo ""

echo -e "${GREEN}=== All tests completed! ===${NC}"

# Cleanup
rm -f /tmp/bms_complaints_cookies.txt

































