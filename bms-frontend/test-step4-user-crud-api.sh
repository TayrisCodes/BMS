#!/bin/bash

# Test script for Step 4 - User CRUD APIs
# This script tests the Step 4 User CRUD API endpoints
# Make sure the dev server is running: npm run dev

BASE_URL="http://localhost:3000"
SESSION_COOKIE="bms_session"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Step 4 - User CRUD APIs Test Script${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Check if server is running
if ! curl -s "$BASE_URL/api/health" > /dev/null 2>&1; then
  echo -e "${RED}❌ Server is not running at $BASE_URL${NC}"
  echo -e "${YELLOW}Please start the dev server with: npm run dev${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Server is running${NC}\n"

# Step 1: Seed SUPER_ADMIN (if not exists)
echo -e "${YELLOW}Step 1: Seeding SUPER_ADMIN...${NC}"
SEED_SUPER_ADMIN=$(curl -s -X POST "$BASE_URL/api/auth/seed-super-admin" \
  -H "Content-Type: application/json")
echo "$SEED_SUPER_ADMIN"
echo ""

# Step 2: Login as SUPER_ADMIN to get session
echo -e "${YELLOW}Step 2: Logging in as SUPER_ADMIN...${NC}"
LOGIN_RESPONSE=$(curl -s -c /tmp/bms_cookies_step4.txt -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"identifier": "superadmin@example.com", "password": "SuperAdmin123!"}')

echo "$LOGIN_RESPONSE"

# Extract session cookie
SESSION_TOKEN=$(grep "$SESSION_COOKIE" /tmp/bms_cookies_step4.txt | awk '{print $7}')

if [ -z "$SESSION_TOKEN" ]; then
  echo -e "${RED}❌ Failed to get session token${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Session token obtained${NC}\n"

# Step 3: Seed organization (if not exists)
echo -e "${YELLOW}Step 3: Seeding organization...${NC}"
SEED_ORG=$(curl -s -X POST "$BASE_URL/api/organizations/seed" \
  -H "Content-Type: application/json")
echo "$SEED_ORG"

ORG_ID=$(echo "$SEED_ORG" | grep -o '"organizationId":"[^"]*"' | cut -d'"' -f4)
if [ -z "$ORG_ID" ]; then
  ORG_ID=$(echo "$SEED_ORG" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
fi

if [ -z "$ORG_ID" ]; then
  echo -e "${RED}❌ Failed to get organization ID${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Organization ID: $ORG_ID${NC}\n"

# Step 4: Test POST /api/users - Create new user
echo -e "${YELLOW}Step 4: Testing POST /api/users - Create new user...${NC}"
TIMESTAMP=$(date +%s)
TEST_PHONE="+2519112${TIMESTAMP: -6}"
TEST_EMAIL="step4test${TIMESTAMP}@example.com"
CREATE_USER=$(curl -s -X POST "$BASE_URL/api/users" \
  -b "$SESSION_COOKIE=$SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"phone\": \"$TEST_PHONE\",
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"TestPassword123!\",
    \"roles\": [\"BUILDING_MANAGER\"],
    \"organizationId\": \"$ORG_ID\",
    \"name\": \"Step 4 Test User\"
  }")

echo "$CREATE_USER"
echo ""

NEW_USER_ID=$(echo "$CREATE_USER" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
if [ -z "$NEW_USER_ID" ]; then
  echo -e "${RED}❌ Failed to create user${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Created user with ID: $NEW_USER_ID${NC}\n"

# Step 5: Test GET /api/users with pagination
echo -e "${YELLOW}Step 5: Testing GET /api/users with pagination (page=1, limit=2)...${NC}"
LIST_USERS_PAGE1=$(curl -s -X GET "$BASE_URL/api/users?page=1&limit=2" \
  -b "$SESSION_COOKIE=$SESSION_TOKEN" \
  -H "Content-Type: application/json")
echo "$LIST_USERS_PAGE1"
echo ""

USERS_COUNT=$(echo "$LIST_USERS_PAGE1" | grep -o '"users":\[[^]]*\]' | grep -o '{' | wc -l)
TOTAL=$(echo "$LIST_USERS_PAGE1" | grep -o '"total":[0-9]*' | cut -d':' -f2)

if [ ! -z "$TOTAL" ] && [ "$TOTAL" -ge 1 ] && [ "$USERS_COUNT" -le 2 ]; then
  echo -e "${GREEN}✅ Pagination working: page 1 has $USERS_COUNT users, total: $TOTAL${NC}\n"
else
  echo -e "${RED}❌ Pagination test failed (users: $USERS_COUNT, total: $TOTAL)${NC}\n"
fi

# Step 6: Test GET /api/users with role filter
echo -e "${YELLOW}Step 6: Testing GET /api/users with role filter (role=BUILDING_MANAGER)...${NC}"
LIST_USERS_ROLE=$(curl -s -X GET "$BASE_URL/api/users?role=BUILDING_MANAGER" \
  -b "$SESSION_COOKIE=$SESSION_TOKEN" \
  -H "Content-Type: application/json")
echo "$LIST_USERS_ROLE"
echo ""

ROLE_USERS_COUNT=$(echo "$LIST_USERS_ROLE" | grep -o '"users":\[[^]]*\]' | grep -o '{' | wc -l)
ROLE_TOTAL=$(echo "$LIST_USERS_ROLE" | grep -o '"total":[0-9]*' | cut -d':' -f2)
if [ ! -z "$ROLE_TOTAL" ] && [ "$ROLE_TOTAL" -ge 1 ]; then
  echo -e "${GREEN}✅ Role filter working: found $ROLE_TOTAL BUILDING_MANAGER users (showing $ROLE_USERS_COUNT)${NC}\n"
else
  echo -e "${RED}❌ Role filter test failed (total: $ROLE_TOTAL)${NC}\n"
fi

# Step 7: Test GET /api/users with status filter
echo -e "${YELLOW}Step 7: Testing GET /api/users with status filter (status=active)...${NC}"
LIST_USERS_STATUS=$(curl -s -X GET "$BASE_URL/api/users?status=active" \
  -b "$SESSION_COOKIE=$SESSION_TOKEN" \
  -H "Content-Type: application/json")
echo "$LIST_USERS_STATUS"
echo ""

STATUS_COUNT=$(echo "$LIST_USERS_STATUS" | grep -o '"total":[0-9]*' | cut -d':' -f2)
if [ ! -z "$STATUS_COUNT" ] && [ "$STATUS_COUNT" -ge 1 ]; then
  echo -e "${GREEN}✅ Status filter working: found $STATUS_COUNT active users${NC}\n"
else
  echo -e "${RED}❌ Status filter test failed${NC}\n"
fi

# Step 8: Test GET /api/users with search
echo -e "${YELLOW}Step 8: Testing GET /api/users with search (search=Step 4)...${NC}"
LIST_USERS_SEARCH=$(curl -s -X GET "$BASE_URL/api/users?search=Step%204" \
  -b "$SESSION_COOKIE=$SESSION_TOKEN" \
  -H "Content-Type: application/json")
echo "$LIST_USERS_SEARCH"
echo ""

SEARCH_COUNT=$(echo "$LIST_USERS_SEARCH" | grep -o '"total":[0-9]*' | cut -d':' -f2)
if [ ! -z "$SEARCH_COUNT" ] && [ "$SEARCH_COUNT" -ge 1 ]; then
  echo -e "${GREEN}✅ Search working: found $SEARCH_COUNT users matching 'Step 4'${NC}\n"
else
  echo -e "${RED}❌ Search test failed${NC}\n"
fi

# Step 9: Test GET /api/users/[id] - Get single user
echo -e "${YELLOW}Step 9: Testing GET /api/users/[id] - Get single user...${NC}"
GET_USER=$(curl -s -X GET "$BASE_URL/api/users/$NEW_USER_ID" \
  -b "$SESSION_COOKIE=$SESSION_TOKEN" \
  -H "Content-Type: application/json")
echo "$GET_USER"
echo ""

USER_NAME=$(echo "$GET_USER" | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
if [ ! -z "$USER_NAME" ] && [ "$USER_NAME" = "Step 4 Test User" ]; then
  echo -e "${GREEN}✅ Get user by ID working: retrieved user '$USER_NAME'${NC}\n"
else
  echo -e "${RED}❌ Get user by ID test failed${NC}\n"
fi

# Step 10: Test PATCH /api/users/[id] - Update user
echo -e "${YELLOW}Step 10: Testing PATCH /api/users/[id] - Update user...${NC}"
UPDATED_EMAIL="step4updated${TIMESTAMP}@example.com"
UPDATE_USER=$(curl -s -X PATCH "$BASE_URL/api/users/$NEW_USER_ID" \
  -b "$SESSION_COOKIE=$SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Updated Step 4 Test User\",
    \"email\": \"$UPDATED_EMAIL\"
  }")
echo "$UPDATE_USER"
echo ""

UPDATED_NAME=$(echo "$UPDATE_USER" | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
if [ ! -z "$UPDATED_NAME" ] && [ "$UPDATED_NAME" = "Updated Step 4 Test User" ]; then
  echo -e "${GREEN}✅ Update user working: updated name to '$UPDATED_NAME'${NC}\n"
else
  echo -e "${RED}❌ Update user test failed${NC}\n"
fi

# Step 11: Test PATCH /api/users/[id]/roles - Update user roles
echo -e "${YELLOW}Step 11: Testing PATCH /api/users/[id]/roles - Update user roles...${NC}"
UPDATE_ROLES=$(curl -s -X PATCH "$BASE_URL/api/users/$NEW_USER_ID/roles" \
  -b "$SESSION_COOKIE=$SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "roles": ["BUILDING_MANAGER", "FACILITY_MANAGER"]
  }')
echo "$UPDATE_ROLES"
echo ""

ROLES_COUNT=$(echo "$UPDATE_ROLES" | grep -o '"roles":\[[^]]*\]' | grep -o ',' | wc -l)
if [ ! -z "$ROLES_COUNT" ] && [ "$ROLES_COUNT" -ge 1 ]; then
  echo -e "${GREEN}✅ Update user roles working: updated roles${NC}\n"
else
  echo -e "${RED}❌ Update user roles test failed${NC}\n"
fi

# Step 12: Test PATCH /api/users/[id]/status - Update user status
echo -e "${YELLOW}Step 12: Testing PATCH /api/users/[id]/status - Update user status...${NC}"
UPDATE_STATUS=$(curl -s -X PATCH "$BASE_URL/api/users/$NEW_USER_ID/status" \
  -b "$SESSION_COOKIE=$SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "suspended"
  }')
echo "$UPDATE_STATUS"
echo ""

STATUS_VALUE=$(echo "$UPDATE_STATUS" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
if [ ! -z "$STATUS_VALUE" ] && [ "$STATUS_VALUE" = "suspended" ]; then
  echo -e "${GREEN}✅ Update user status working: status set to '$STATUS_VALUE'${NC}\n"
  
  # Reactivate user
  echo -e "${YELLOW}Reactivating user...${NC}"
  REACTIVATE=$(curl -s -X PATCH "$BASE_URL/api/users/$NEW_USER_ID/status" \
    -b "$SESSION_COOKIE=$SESSION_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "status": "active"
    }')
  echo "$REACTIVATE"
  echo -e "${GREEN}✅ User reactivated${NC}\n"
else
  echo -e "${RED}❌ Update user status test failed${NC}\n"
fi

# Step 13: Test POST /api/users - Validate password strength
echo -e "${YELLOW}Step 13: Testing POST /api/users - Password validation (weak password)...${NC}"
CREATE_USER_WEAK_PASSWORD=$(curl -s -X POST "$BASE_URL/api/users" \
  -b "$SESSION_COOKIE=$SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"phone\": \"+251911200002\",
    \"email\": \"weakpass@example.com\",
    \"password\": \"weak\",
    \"roles\": [\"TECHNICIAN\"],
    \"organizationId\": \"$ORG_ID\"
  }")
echo "$CREATE_USER_WEAK_PASSWORD"
echo ""

if echo "$CREATE_USER_WEAK_PASSWORD" | grep -q "Password does not meet requirements"; then
  echo -e "${GREEN}✅ Password validation working: rejected weak password${NC}\n"
else
  echo -e "${RED}❌ Password validation test failed${NC}\n"
fi

# Step 14: Test POST /api/users - Validate phone uniqueness
echo -e "${YELLOW}Step 14: Testing POST /api/users - Phone uniqueness validation...${NC}"
CREATE_USER_DUPLICATE_PHONE=$(curl -s -X POST "$BASE_URL/api/users" \
  -b "$SESSION_COOKIE=$SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"phone\": \"$TEST_PHONE\",
    \"email\": \"duplicatephone${TIMESTAMP}@example.com\",
    \"password\": \"TestPassword123!\",
    \"roles\": [\"TECHNICIAN\"],
    \"organizationId\": \"$ORG_ID\"
  }")
echo "$CREATE_USER_DUPLICATE_PHONE"
echo ""

if echo "$CREATE_USER_DUPLICATE_PHONE" | grep -q "Phone number already exists"; then
  echo -e "${GREEN}✅ Phone uniqueness validation working: rejected duplicate phone${NC}\n"
else
  echo -e "${RED}❌ Phone uniqueness validation test failed${NC}\n"
fi

# Step 15: Test POST /api/users - Validate email uniqueness
echo -e "${YELLOW}Step 15: Testing POST /api/users - Email uniqueness validation...${NC}"
# Use the updated email from Step 10 which should already exist
CREATE_USER_DUPLICATE_EMAIL=$(curl -s -X POST "$BASE_URL/api/users" \
  -b "$SESSION_COOKIE=$SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"phone\": \"+2519112${TIMESTAMP: -5}9\",
    \"email\": \"$UPDATED_EMAIL\",
    \"password\": \"TestPassword123!\",
    \"roles\": [\"TECHNICIAN\"],
    \"organizationId\": \"$ORG_ID\"
  }")
echo "$CREATE_USER_DUPLICATE_EMAIL"
echo ""

if echo "$CREATE_USER_DUPLICATE_EMAIL" | grep -q "Email already exists"; then
  echo -e "${GREEN}✅ Email uniqueness validation working: rejected duplicate email${NC}\n"
else
  echo -e "${RED}❌ Email uniqueness validation test failed${NC}\n"
fi

# Step 16: Test DELETE /api/users/[id] - Soft delete user
echo -e "${YELLOW}Step 16: Testing DELETE /api/users/[id] - Soft delete user...${NC}"
DELETE_USER=$(curl -s -X DELETE "$BASE_URL/api/users/$NEW_USER_ID" \
  -b "$SESSION_COOKIE=$SESSION_TOKEN" \
  -H "Content-Type: application/json")
echo "$DELETE_USER"
echo ""

if echo "$DELETE_USER" | grep -q "User deleted successfully"; then
  echo -e "${GREEN}✅ Delete user working: user soft deleted${NC}\n"
  
  # Verify user status is inactive
  echo -e "${YELLOW}Verifying user status is inactive...${NC}"
  GET_DELETED_USER=$(curl -s -X GET "$BASE_URL/api/users/$NEW_USER_ID" \
    -b "$SESSION_COOKIE=$SESSION_TOKEN" \
    -H "Content-Type: application/json")
  DELETED_STATUS=$(echo "$GET_DELETED_USER" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
  if [ "$DELETED_STATUS" = "inactive" ]; then
    echo -e "${GREEN}✅ User status correctly set to inactive${NC}\n"
  else
    echo -e "${YELLOW}⚠️  User status is: $DELETED_STATUS (expected inactive)${NC}\n"
  fi
else
  echo -e "${RED}❌ Delete user test failed${NC}\n"
fi

# Cleanup
rm -f /tmp/bms_cookies_step4.txt

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Step 4 API Tests Completed!${NC}"
echo -e "${BLUE}========================================${NC}\n"

