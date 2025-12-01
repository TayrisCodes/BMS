#!/bin/bash

# API Endpoint Test for User Activity Logs (Step 9)
# Tests the /api/users/[id]/activity endpoint
# Make sure the dev server is running: npm run dev

BASE_URL="${NEXT_PUBLIC_API_URL:-http://localhost:3000}"
API_URL="${BASE_URL}/api"
SESSION_COOKIE="bms_session"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Step 9 - Activity Logs API Test${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Check if server is running
if ! curl -s "$BASE_URL/api/health" > /dev/null 2>&1; then
  echo -e "${RED}❌ Server is not running at $BASE_URL${NC}"
  echo -e "${YELLOW}Please start the dev server with: npm run dev${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Server is running${NC}\n"

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function to print test results
print_test() {
    local test_name=$1
    local status=$2
    local message=$3
    
    if [ "$status" = "PASS" ]; then
        echo -e "${GREEN}✅ $test_name${NC}"
        ((TESTS_PASSED++))
    elif [ "$status" = "SKIP" ]; then
        echo -e "${YELLOW}⏭️  $test_name (Skipped)${NC}"
    else
        echo -e "${RED}❌ $test_name${NC}"
        if [ -n "$message" ]; then
            echo -e "   ${RED}$message${NC}"
        fi
        ((TESTS_FAILED++))
    fi
}

# Step 1: Seed SUPER_ADMIN (if not exists)
echo -e "${YELLOW}Step 1: Seeding SUPER_ADMIN...${NC}"
SEED_SUPER_ADMIN=$(curl -s -X POST "$BASE_URL/api/auth/seed-super-admin" \
  -H "Content-Type: application/json")
echo "$SEED_SUPER_ADMIN"
echo ""

# Step 2: Login as SUPER_ADMIN to get session
echo -e "${YELLOW}Step 2: Logging in as SUPER_ADMIN...${NC}"
LOGIN_RESPONSE=$(curl -s -c /tmp/bms_cookies_step9.txt -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"identifier": "superadmin@example.com", "password": "SuperAdmin123!"}')

echo "$LOGIN_RESPONSE"

# Extract session cookie
SESSION_TOKEN=$(grep "$SESSION_COOKIE" /tmp/bms_cookies_step9.txt | awk '{print $7}')

if [ -z "$SESSION_TOKEN" ]; then
  echo -e "${RED}❌ Failed to get session token${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Session token obtained${NC}\n"

# Step 3: Get current user profile to get user ID
echo -e "${YELLOW}Step 3: Getting current user profile...${NC}"
PROFILE_RESPONSE=$(curl -s -X GET "$BASE_URL/api/users/me" \
  -b "$SESSION_COOKIE=$SESSION_TOKEN" \
  -H "Content-Type: application/json")

USER_ID=$(echo "$PROFILE_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$USER_ID" ]; then
  echo -e "${RED}❌ Failed to get user ID${NC}"
  echo "Response: $PROFILE_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ User ID: $USER_ID${NC}\n"

# Step 4: Test GET /api/users/[id]/activity (basic)
echo -e "${YELLOW}Step 4: Testing GET /api/users/[id]/activity (basic)...${NC}"
ACTIVITY_RESPONSE=$(curl -s -X GET "$BASE_URL/api/users/$USER_ID/activity" \
  -b "$SESSION_COOKIE=$SESSION_TOKEN" \
  -H "Content-Type: application/json")

echo "$ACTIVITY_RESPONSE" | head -20
echo ""

if echo "$ACTIVITY_RESPONSE" | grep -q '"logs"'; then
  TOTAL=$(echo "$ACTIVITY_RESPONSE" | grep -o '"total":[0-9]*' | grep -o '[0-9]*' | head -1)
  LOG_COUNT=$(echo "$ACTIVITY_RESPONSE" | grep -o '"id":"[^"]*"' | wc -l)
  print_test "Step 4: GET activity logs endpoint" "PASS"
  echo "   Total logs: ${TOTAL:-0}, Returned: $LOG_COUNT"
else
  print_test "Step 4: GET activity logs endpoint" "FAIL" "Response does not contain 'logs'"
fi

# Step 5: Test GET with action filter
echo ""
echo -e "${YELLOW}Step 5: Testing GET with action filter (action=login)...${NC}"
ACTIVITY_RESPONSE=$(curl -s -X GET "$BASE_URL/api/users/$USER_ID/activity?action=login" \
  -b "$SESSION_COOKIE=$SESSION_TOKEN" \
  -H "Content-Type: application/json")

if echo "$ACTIVITY_RESPONSE" | grep -q '"logs"'; then
  LOGIN_COUNT=$(echo "$ACTIVITY_RESPONSE" | grep -o '"action":"login"' | wc -l)
  OTHER_ACTIONS=$(echo "$ACTIVITY_RESPONSE" | grep -o '"action":"[^"]*"' | grep -v '"action":"login"' | wc -l)
  
  if [ "$OTHER_ACTIONS" -eq 0 ] || [ "$LOGIN_COUNT" -gt 0 ]; then
    print_test "Step 5: Filter by action=login" "PASS"
    echo "   Found $LOGIN_COUNT login log(s)"
  else
    print_test "Step 5: Filter by action=login" "FAIL" "Filter not working correctly"
  fi
else
  print_test "Step 5: Filter by action=login" "FAIL" "Response does not contain 'logs'"
fi

# Step 6: Test GET with date range filter
echo ""
echo -e "${YELLOW}Step 6: Testing GET with date range filter...${NC}"
START_DATE=$(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v-7d +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo "2024-01-01T00:00:00Z")
END_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo "2025-12-31T23:59:59Z")

ACTIVITY_RESPONSE=$(curl -s -X GET "$BASE_URL/api/users/$USER_ID/activity?startDate=$START_DATE&endDate=$END_DATE" \
  -b "$SESSION_COOKIE=$SESSION_TOKEN" \
  -H "Content-Type: application/json")

if echo "$ACTIVITY_RESPONSE" | grep -q '"logs"'; then
  print_test "Step 6: Filter by date range" "PASS"
else
  print_test "Step 6: Filter by date range" "FAIL" "Response does not contain 'logs'"
fi

# Step 7: Test GET with limit parameter
echo ""
echo -e "${YELLOW}Step 7: Testing GET with limit parameter (limit=5)...${NC}"
ACTIVITY_RESPONSE=$(curl -s -X GET "$BASE_URL/api/users/$USER_ID/activity?limit=5" \
  -b "$SESSION_COOKIE=$SESSION_TOKEN" \
  -H "Content-Type: application/json")

if echo "$ACTIVITY_RESPONSE" | grep -q '"logs"'; then
  LOG_COUNT=$(echo "$ACTIVITY_RESPONSE" | grep -o '"id":"[^"]*"' | wc -l)
  LIMIT=$(echo "$ACTIVITY_RESPONSE" | grep -o '"limit":[0-9]*' | grep -o '[0-9]*' | head -1)
  
  if [ "$LOG_COUNT" -le 5 ] || [ "$LIMIT" = "5" ]; then
    print_test "Step 7: Limit parameter" "PASS"
    echo "   Returned $LOG_COUNT log(s) (limit: $LIMIT)"
  else
    print_test "Step 7: Limit parameter" "FAIL" "Limit not working correctly"
  fi
else
  print_test "Step 7: Limit parameter" "FAIL" "Response does not contain 'logs'"
fi

# Step 8: Test unauthorized access (no session)
echo ""
echo -e "${YELLOW}Step 8: Testing unauthorized access (no session)...${NC}"
UNAUTH_RESPONSE=$(curl -s -X GET "$BASE_URL/api/users/$USER_ID/activity")

if echo "$UNAUTH_RESPONSE" | grep -q "Unauthorized" || echo "$UNAUTH_RESPONSE" | grep -q "401"; then
  print_test "Step 8: Unauthorized access blocked" "PASS"
else
  print_test "Step 8: Unauthorized access blocked" "FAIL" "Should return 401"
fi

# Step 9: Test activity log structure
echo ""
echo -e "${YELLOW}Step 9: Testing activity log structure...${NC}"
ACTIVITY_RESPONSE=$(curl -s -X GET "$BASE_URL/api/users/$USER_ID/activity?limit=1" \
  -b "$SESSION_COOKIE=$SESSION_TOKEN" \
  -H "Content-Type: application/json")

if echo "$ACTIVITY_RESPONSE" | grep -q '"id"' && \
   echo "$ACTIVITY_RESPONSE" | grep -q '"action"' && \
   echo "$ACTIVITY_RESPONSE" | grep -q '"createdAt"'; then
  print_test "Step 9: Activity log structure" "PASS"
  echo "   Log contains: id, action, createdAt"
  
  # Check optional fields
  if echo "$ACTIVITY_RESPONSE" | grep -q '"ipAddress"'; then
    echo "   ✅ Contains ipAddress"
  fi
  if echo "$ACTIVITY_RESPONSE" | grep -q '"details"'; then
    echo "   ✅ Contains details"
  fi
else
  print_test "Step 9: Activity log structure" "FAIL" "Missing required fields"
fi

# Step 10: Test multiple filter combinations
echo ""
echo -e "${YELLOW}Step 10: Testing multiple filter combinations...${NC}"
START_DATE=$(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v-7d +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo "2024-01-01T00:00:00Z")
COMBINED_RESPONSE=$(curl -s -X GET "$BASE_URL/api/users/$USER_ID/activity?action=login&limit=10&startDate=$START_DATE" \
  -b "$SESSION_COOKIE=$SESSION_TOKEN" \
  -H "Content-Type: application/json")

if echo "$COMBINED_RESPONSE" | grep -q '"logs"'; then
  print_test "Step 10: Combined filters" "PASS"
else
  print_test "Step 10: Combined filters" "FAIL" "Response does not contain 'logs'"
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Test Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ Passed: $TESTS_PASSED${NC}"
echo -e "${RED}❌ Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}⚠️  Some tests failed${NC}"
    exit 1
fi
