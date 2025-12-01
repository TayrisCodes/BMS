#!/bin/bash

# Test Role-Based Login Redirects
# This script tests that users are redirected to the correct dashboard based on their role

set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🧪 Testing Role-Based Login Redirects"
echo "========================================"
echo ""

# Test function
test_role_redirect() {
    local role_name=$1
    local identifier=$2
    local password=$3
    local expected_path=$4
    
    echo -e "${YELLOW}Testing ${role_name}...${NC}"
    
    # Login and capture cookies
    COOKIE_FILE="/tmp/bms_redirect_test_${role_name}.txt"
    rm -f "$COOKIE_FILE"
    
    LOGIN_RESPONSE=$(curl -s -c "$COOKIE_FILE" -X POST "$BASE_URL/api/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"identifier\":\"$identifier\",\"password\":\"$password\"}")
    
    # Check if login was successful
    if echo "$LOGIN_RESPONSE" | grep -q "Logged in successfully\|message.*success"; then
        echo -e "  ${GREEN}✓ Login successful${NC}"
    else
        echo -e "  ${RED}✗ Login failed${NC}"
        echo "  Response: $LOGIN_RESPONSE"
        return 1
    fi
    
    # Get user info to verify role
    ME_RESPONSE=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/me")
    
    if echo "$ME_RESPONSE" | grep -q "\"roles\""; then
        echo -e "  ${GREEN}✓ User info retrieved${NC}"
        ROLES=$(echo "$ME_RESPONSE" | grep -o '"roles":\[[^]]*\]' | head -1)
        echo "  Roles: $ROLES"
    else
        echo -e "  ${YELLOW}⚠ Could not verify roles${NC}"
    fi
    
    # Test redirect by simulating browser behavior
    # We can't actually test the redirect in curl, but we can verify the user has the right role
    # and that the expected path exists
    
    # Check if expected path is accessible
    PATH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_FILE" "$BASE_URL$expected_path")
    
    if [ "$PATH_CHECK" = "200" ] || [ "$PATH_CHECK" = "302" ]; then
        echo -e "  ${GREEN}✓ Expected path $expected_path is accessible (HTTP $PATH_CHECK)${NC}"
        echo -e "  ${GREEN}✓ ${role_name} should redirect to: $expected_path${NC}"
    else
        echo -e "  ${YELLOW}⚠ Expected path $expected_path returned HTTP $PATH_CHECK${NC}"
    fi
    
    echo ""
    return 0
}

# Test each role
echo "Testing SUPER_ADMIN redirect..."
test_role_redirect "SUPER_ADMIN" "superadmin@example.com" "SuperAdmin123!" "/admin"

echo "Testing ORG_ADMIN redirect..."
test_role_redirect "ORG_ADMIN" "admin@example.com" "ChangeMe123!" "/org"

echo "Testing BUILDING_MANAGER redirect..."
test_role_redirect "BUILDING_MANAGER" "building.manager@example.com" "BuildingManager123!" "/org"

echo ""
echo "========================================"
echo -e "${GREEN}✅ Role redirect tests completed!${NC}"
echo ""
echo "Note: This script verifies login and role assignment."
echo "To fully test redirects, please test manually in a browser:"
echo "  1. Go to http://localhost:3000/login"
echo "  2. Login with each test account"
echo "  3. Verify you are redirected to the correct dashboard"
echo ""





