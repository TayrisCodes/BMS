#!/bin/bash

# Full password reset flow test
# This test simulates the complete password reset flow including getting the token

BASE_URL="http://localhost:3000"
SESSION_COOKIE="bms_session"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Full Password Reset Flow Test${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Check if server is running
if ! curl -s "$BASE_URL/api/health" > /dev/null 2>&1; then
  echo -e "${RED}❌ Server is not running${NC}"
  exit 1
fi

# Step 1: Login as SUPER_ADMIN
echo -e "${YELLOW}Step 1: Logging in as SUPER_ADMIN...${NC}"
LOGIN_RESPONSE=$(curl -s -c /tmp/bms_cookies.txt -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"identifier": "superadmin@example.com", "password": "SuperAdmin123!"}')

SESSION_TOKEN=$(grep "$SESSION_COOKIE" /tmp/bms_cookies.txt | awk '{print $7}')
if [ -z "$SESSION_TOKEN" ]; then
  echo -e "${RED}❌ Failed to get session token${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Logged in${NC}\n"

# Step 2: Create test user
echo -e "${YELLOW}Step 2: Creating test user...${NC}"
SEED_ORG=$(curl -s -X POST "$BASE_URL/api/organizations/seed" \
  -H "Content-Type: application/json")
ORG_ID=$(echo "$SEED_ORG" | grep -o '"organizationId":"[^"]*"' | cut -d'"' -f4)
if [ -z "$ORG_ID" ]; then
  ORG_ID=$(echo "$SEED_ORG" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
fi

TEST_EMAIL="pwreset.$(date +%s)@example.com"
INVITE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/users/invite" \
  -b "$SESSION_COOKIE=$SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"phone\": \"+251911$(date +%s | tail -c 6)\",
    \"roles\": [\"BUILDING_MANAGER\"]
  }")

INVITE_TOKEN=$(echo "$INVITE_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
TEST_USER_ID=$(echo "$INVITE_RESPONSE" | grep -o '"userId":"[^"]*"' | cut -d'"' -f4)

# Activate user
curl -s -X POST "$BASE_URL/api/users/activate" \
  -H "Content-Type: application/json" \
  -d "{
    \"token\": \"$INVITE_TOKEN\",
    \"password\": \"OriginalPassword123!\"
  }" > /dev/null

echo -e "${GREEN}✅ Test user created: $TEST_EMAIL${NC}\n"

# Step 3: Request password reset
echo -e "${YELLOW}Step 3: Requesting password reset...${NC}"
FORGOT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/forgot-password" \
  -H "Content-Type: application/json" \
  -d "{\"emailOrPhone\": \"$TEST_EMAIL\"}")

if echo "$FORGOT_RESPONSE" | grep -q "message"; then
  echo -e "${GREEN}✅ Password reset request sent${NC}"
else
  echo -e "${RED}❌ Failed to send reset request${NC}"
  exit 1
fi

# Step 4: Get reset token from database (for testing only)
echo -e "${YELLOW}Step 4: Getting reset token from database (test only)...${NC}"
RESET_TOKEN=$(MONGODB_URI="mongodb://bms_root:bms_password@localhost:27021/bms?authSource=admin" \
  node -e "
    import('mongodb').then(async ({ MongoClient, ObjectId }) => {
      const client = new MongoClient(process.env.MONGODB_URI);
      await client.connect();
      const db = client.db();
      const user = await db.collection('users').findOne({ _id: new ObjectId('$TEST_USER_ID') });
      console.log(user?.resetPasswordToken || '');
      await client.close();
    });
  " 2>/dev/null)

if [ -z "$RESET_TOKEN" ]; then
  echo -e "${RED}❌ Failed to get reset token${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Reset token retrieved: ${RESET_TOKEN:0:20}...${NC}\n"

# Step 5: Test reset password with valid token
echo -e "${YELLOW}Step 5: Resetting password with valid token...${NC}"
RESET_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/reset-password" \
  -H "Content-Type: application/json" \
  -d "{
    \"token\": \"$RESET_TOKEN\",
    \"newPassword\": \"NewResetPassword123!\"
  }")

if echo "$RESET_RESPONSE" | grep -q "successfully"; then
  echo -e "${GREEN}✅ Password reset successfully${NC}"
else
  echo -e "${RED}❌ Password reset failed: $RESET_RESPONSE${NC}"
  exit 1
fi

# Step 6: Test login with new password
echo -e "${YELLOW}Step 6: Testing login with new password...${NC}"
LOGIN_TEST=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"identifier\": \"$TEST_EMAIL\",
    \"password\": \"NewResetPassword123!\"
  }")

if echo "$LOGIN_TEST" | grep -q "Logged in successfully"; then
  echo -e "${GREEN}✅ Login with new password successful${NC}"
else
  echo -e "${RED}❌ Login with new password failed${NC}"
  exit 1
fi

echo ""
echo -e "${GREEN}✅ Full password reset flow test completed successfully!${NC}"


















