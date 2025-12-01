#!/bin/bash

# Test script for Dashboard Activity API endpoint
# Make sure the dev server is running: npm run dev

BASE_URL="http://localhost:3000"
SESSION_COOKIE="bms_session"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== BMS Dashboard Activity API Test Script ===${NC}\n"

# Check if server is running
if ! curl -s "$BASE_URL/api/health" > /dev/null 2>&1; then
  echo -e "${RED}❌ Server is not running at $BASE_URL${NC}"
  echo -e "${YELLOW}Please start the dev server with: npm run dev${NC}"
  exit 1
fi

# Step 1: Login as ORG_ADMIN
echo -e "${YELLOW}Step 1: Logging in as ORG_ADMIN...${NC}"
ORG_ADMIN_LOGIN=$(curl -s -c /tmp/bms_activity_cookies.txt -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"identifier": "admin@example.com", "password": "ChangeMe123!"}')

echo "$ORG_ADMIN_LOGIN"

ORG_ADMIN_SESSION=$(grep "$SESSION_COOKIE" /tmp/bms_activity_cookies.txt | awk '{print $7}')

if [ -z "$ORG_ADMIN_SESSION" ]; then
  echo -e "${RED}❌ Failed to get ORG_ADMIN session token${NC}"
  exit 1
fi

echo -e "${GREEN}✅ ORG_ADMIN session token obtained${NC}\n"

# Step 2: Test GET /api/dashboard/activity (Get dashboard activities)
echo -e "${YELLOW}Step 2: GET /api/dashboard/activity (Get dashboard activities)...${NC}"
ACTIVITY_RESPONSE=$(curl -s -X GET "$BASE_URL/api/dashboard/activity" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")

echo "$ACTIVITY_RESPONSE" | jq '.' 2>/dev/null || echo "$ACTIVITY_RESPONSE"
echo ""

# Check if response contains activities array
if echo "$ACTIVITY_RESPONSE" | grep -q '"activities"'; then
  echo -e "${GREEN}✅ Dashboard activity API returned activities${NC}"
  
  # Extract count if available
  COUNT=$(echo "$ACTIVITY_RESPONSE" | grep -o '"count":[0-9]*' | cut -d':' -f2)
  if [ -n "$COUNT" ]; then
    echo -e "${GREEN}✅ Activity count: $COUNT${NC}"
  fi
  
  # Extract activity types
  ACTIVITY_TYPES=$(echo "$ACTIVITY_RESPONSE" | grep -o '"type":"[^"]*"' | cut -d'"' -f4 | sort -u)
  if [ -n "$ACTIVITY_TYPES" ]; then
    echo -e "${GREEN}✅ Activity types found: $(echo $ACTIVITY_TYPES | tr '\n' ' ')${NC}"
  fi
else
  echo -e "${RED}❌ Dashboard activity API did not return expected format${NC}"
  echo -e "${YELLOW}Response: $ACTIVITY_RESPONSE${NC}"
fi

echo ""

# Step 3: Verify activity structure
echo -e "${YELLOW}Step 3: Verifying activity structure...${NC}"
if echo "$ACTIVITY_RESPONSE" | grep -q '"id"'; then
  echo -e "${GREEN}✅ Activities have 'id' field${NC}"
fi

if echo "$ACTIVITY_RESPONSE" | grep -q '"type"'; then
  echo -e "${GREEN}✅ Activities have 'type' field${NC}"
fi

if echo "$ACTIVITY_RESPONSE" | grep -q '"title"'; then
  echo -e "${GREEN}✅ Activities have 'title' field${NC}"
fi

if echo "$ACTIVITY_RESPONSE" | grep -q '"description"'; then
  echo -e "${GREEN}✅ Activities have 'description' field${NC}"
fi

if echo "$ACTIVITY_RESPONSE" | grep -q '"timestamp"'; then
  echo -e "${GREEN}✅ Activities have 'timestamp' field${NC}"
fi

if echo "$ACTIVITY_RESPONSE" | grep -q '"link"'; then
  echo -e "${GREEN}✅ Activities have 'link' field${NC}"
fi

echo ""

# Step 4: Test with unauthenticated request (should fail)
echo -e "${YELLOW}Step 4: Testing unauthenticated request (should fail)...${NC}"
UNAUTH_RESPONSE=$(curl -s -X GET "$BASE_URL/api/dashboard/activity" \
  -H "Content-Type: application/json")

if echo "$UNAUTH_RESPONSE" | grep -q '"error"'; then
  echo -e "${GREEN}✅ Unauthenticated request correctly rejected${NC}"
  echo "$UNAUTH_RESPONSE" | jq '.' 2>/dev/null || echo "$UNAUTH_RESPONSE"
else
  echo -e "${RED}❌ Unauthenticated request should have been rejected${NC}"
  echo "$UNAUTH_RESPONSE"
fi

echo ""

# Step 5: Summary
echo -e "${YELLOW}=== Test Summary ===${NC}"
echo -e "${GREEN}✅ Dashboard Activity API test completed${NC}"
echo -e "${YELLOW}The API should return activities from payments, leases, and complaints${NC}"
echo -e "${YELLOW}All activities should be properly scoped to the organization${NC}"
echo ""

# Cleanup
rm -f /tmp/bms_activity_cookies.txt



















