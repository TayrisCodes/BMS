#!/bin/bash

# Test script for Ensure Indexes API endpoint
# Make sure the dev server is running: npm run dev

BASE_URL="http://localhost:3000"
SESSION_COOKIE="bms_session"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== BMS Ensure Indexes API Test Script ===${NC}\n"

# Check if server is running
if ! curl -s "$BASE_URL/api/health" > /dev/null 2>&1; then
  echo -e "${RED}❌ Server is not running at $BASE_URL${NC}"
  echo -e "${YELLOW}Please start the dev server with: npm run dev${NC}"
  exit 1
fi

# Step 1: Test with unauthenticated request (should fail)
echo -e "${YELLOW}Step 1: Testing unauthenticated request (should fail)...${NC}"
UNAUTH_RESPONSE=$(curl -s -X POST "$BASE_URL/api/admin/ensure-indexes" \
  -H "Content-Type: application/json")

if echo "$UNAUTH_RESPONSE" | grep -q '"error"'; then
  echo -e "${GREEN}✅ Unauthenticated request correctly rejected${NC}"
  echo "$UNAUTH_RESPONSE" | jq '.' 2>/dev/null || echo "$UNAUTH_RESPONSE"
else
  echo -e "${RED}❌ Unauthenticated request should have been rejected${NC}"
  echo "$UNAUTH_RESPONSE"
fi

echo ""

# Step 2: Login as ORG_ADMIN (should fail - not SUPER_ADMIN)
echo -e "${YELLOW}Step 2: Logging in as ORG_ADMIN (should fail - not SUPER_ADMIN)...${NC}"
ORG_ADMIN_LOGIN=$(curl -s -c /tmp/bms_indexes_cookies.txt -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"identifier": "admin@example.com", "password": "ChangeMe123!"}')

echo "$ORG_ADMIN_LOGIN"

ORG_ADMIN_SESSION=$(grep "$SESSION_COOKIE" /tmp/bms_indexes_cookies.txt | awk '{print $7}')

if [ -z "$ORG_ADMIN_SESSION" ]; then
  echo -e "${RED}❌ Failed to get ORG_ADMIN session token${NC}"
  exit 1
fi

echo -e "${GREEN}✅ ORG_ADMIN session token obtained${NC}\n"

# Step 3: Test POST /api/admin/ensure-indexes as ORG_ADMIN (should fail)
echo -e "${YELLOW}Step 3: POST /api/admin/ensure-indexes as ORG_ADMIN (should fail - not SUPER_ADMIN)...${NC}"
ORG_ADMIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/admin/ensure-indexes" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")

if echo "$ORG_ADMIN_RESPONSE" | grep -q '"error"'; then
  if echo "$ORG_ADMIN_RESPONSE" | grep -q "SUPER_ADMIN"; then
    echo -e "${GREEN}✅ ORG_ADMIN correctly rejected (requires SUPER_ADMIN)${NC}"
    echo "$ORG_ADMIN_RESPONSE" | jq '.' 2>/dev/null || echo "$ORG_ADMIN_RESPONSE"
  else
    echo -e "${YELLOW}⚠️  Request rejected but error message doesn't mention SUPER_ADMIN${NC}"
    echo "$ORG_ADMIN_RESPONSE"
  fi
else
  echo -e "${RED}❌ ORG_ADMIN request should have been rejected${NC}"
  echo "$ORG_ADMIN_RESPONSE"
fi

echo ""

# Step 4: Login as SUPER_ADMIN (if available)
echo -e "${YELLOW}Step 4: Attempting to login as SUPER_ADMIN...${NC}"
echo -e "${YELLOW}Note: You may need to seed a SUPER_ADMIN user first${NC}"
echo -e "${YELLOW}Run: curl -X POST $BASE_URL/api/auth/seed-super-admin${NC}\n"

# Try to seed SUPER_ADMIN first
SEED_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/seed-super-admin" \
  -H "Content-Type: application/json")

echo "Seed response: $SEED_RESPONSE"
echo ""

# Try to login as SUPER_ADMIN (default credentials from seed script)
SUPER_ADMIN_LOGIN=$(curl -s -c /tmp/bms_super_admin_cookies.txt -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"identifier": "superadmin@example.com", "password": "SuperAdmin123!"}')

echo "$SUPER_ADMIN_LOGIN"

SUPER_ADMIN_SESSION=$(grep "$SESSION_COOKIE" /tmp/bms_super_admin_cookies.txt | awk '{print $7}')

if [ -z "$SUPER_ADMIN_SESSION" ]; then
  echo -e "${YELLOW}⚠️  Could not get SUPER_ADMIN session. Skipping SUPER_ADMIN test.${NC}"
  echo -e "${YELLOW}You may need to seed a SUPER_ADMIN user first.${NC}"
  echo ""
else
  echo -e "${GREEN}✅ SUPER_ADMIN session token obtained${NC}\n"

  # Step 5: Test POST /api/admin/ensure-indexes as SUPER_ADMIN (should succeed)
  echo -e "${YELLOW}Step 5: POST /api/admin/ensure-indexes as SUPER_ADMIN (should succeed)...${NC}"
  SUPER_ADMIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/admin/ensure-indexes" \
    -b "$SESSION_COOKIE=$SUPER_ADMIN_SESSION" \
    -H "Content-Type: application/json")

  echo "$SUPER_ADMIN_RESPONSE" | jq '.' 2>/dev/null || echo "$SUPER_ADMIN_RESPONSE"
  echo ""

  if echo "$SUPER_ADMIN_RESPONSE" | grep -q '"message"'; then
    if echo "$SUPER_ADMIN_RESPONSE" | grep -q "successfully"; then
      echo -e "${GREEN}✅ Indexes ensured successfully${NC}"
    else
      echo -e "${YELLOW}⚠️  Response contains message but may not indicate success${NC}"
    fi
  elif echo "$SUPER_ADMIN_RESPONSE" | grep -q '"error"'; then
    echo -e "${RED}❌ Error ensuring indexes${NC}"
  else
    echo -e "${YELLOW}⚠️  Unexpected response format${NC}"
  fi
fi

echo ""

# Step 6: Summary
echo -e "${YELLOW}=== Test Summary ===${NC}"
echo -e "${GREEN}✅ Ensure Indexes API test completed${NC}"
echo -e "${YELLOW}The API should:${NC}"
echo -e "${YELLOW}  - Reject unauthenticated requests${NC}"
echo -e "${YELLOW}  - Reject non-SUPER_ADMIN users${NC}"
echo -e "${YELLOW}  - Allow SUPER_ADMIN to ensure all indexes${NC}"
echo ""

# Cleanup
rm -f /tmp/bms_indexes_cookies.txt /tmp/bms_super_admin_cookies.txt

