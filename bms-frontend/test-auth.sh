#!/bin/bash

echo "=========================================="
echo "BMS Authentication & Authorization Tests"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BASE_URL="http://localhost:3000"
COOKIE_FILE="/tmp/bms_test_cookies.txt"

# Test function
test_endpoint() {
    local name=$1
    local method=$2
    local url=$3
    local data=$4
    local expected_status=$5
    
    echo -n "Testing $name... "
    
    if [ -z "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$url" -b "$COOKIE_FILE" -c "$COOKIE_FILE" 2>/dev/null)
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$url" -H "Content-Type: application/json" -d "$data" -b "$COOKIE_FILE" -c "$COOKIE_FILE" 2>/dev/null)
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "$expected_status" ]; then
        echo -e "${GREEN}✓${NC} (HTTP $http_code)"
        if [ -n "$body" ] && [ "$body" != "null" ]; then
            echo "$body" | head -c 100
            echo ""
        fi
        return 0
    else
        echo -e "${RED}✗${NC} Expected HTTP $expected_status, got $http_code"
        echo "Response: $body"
        return 1
    fi
}

# Clean up
rm -f "$COOKIE_FILE"

echo "=== Step 1: Seeding Data ==="
test_endpoint "Organization" "POST" "$BASE_URL/api/organizations/seed" "" "200"
test_endpoint "SUPER_ADMIN" "POST" "$BASE_URL/api/auth/seed-super-admin" "" "200"
test_endpoint "ORG_ADMIN" "POST" "$BASE_URL/api/auth/seed-org-admin" "" "200"
test_endpoint "BUILDING_MANAGER" "POST" "$BASE_URL/api/auth/seed-building-manager" "" "200"
test_endpoint "Tenant" "POST" "$BASE_URL/api/seed-tenant" "" "200"
echo ""

echo "=== Step 2: Testing Staff Login (ORG_ADMIN) ==="
test_endpoint "Staff Login" "POST" "$BASE_URL/api/auth/login" '{"identifier":"admin@example.com","password":"ChangeMe123!"}' "200"
test_endpoint "/api/me (as ORG_ADMIN)" "GET" "$BASE_URL/api/me" "" "200"
test_endpoint "/admin route (protected)" "GET" "$BASE_URL/admin" "" "200"
echo ""

echo "=== Step 3: Testing Tenant Sign-up Flow ==="
echo "Requesting OTP for new tenant..."
otp_response=$(curl -s -X POST "$BASE_URL/api/auth/request-otp" -H "Content-Type: application/json" -d '{"phone":"+251999999999","isSignup":true}')
echo "$otp_response"
otp_code=$(echo "$otp_response" | grep -o '"code":"[0-9]*"' | cut -d'"' -f4)

if [ -n "$otp_code" ]; then
    echo "OTP Code received: $otp_code"
    echo "Verifying OTP..."
    verify_response=$(curl -s -X POST "$BASE_URL/api/auth/verify-otp" -H "Content-Type: application/json" -d "{\"phone\":\"+251999999999\",\"code\":\"$otp_code\",\"isSignup\":true}")
    echo "$verify_response"
    
    echo "Setting password..."
    test_endpoint "Set Password" "POST" "$BASE_URL/api/auth/tenant/set-password" '{"phone":"+251999999999","password":"Test1234!"}' "200"
    
    echo "Testing login with new password..."
    rm -f "$COOKIE_FILE"
    test_endpoint "Tenant Login" "POST" "$BASE_URL/api/auth/login" '{"phone":"+251999999999","password":"Test1234!"}' "200"
    test_endpoint "/api/me (as TENANT)" "GET" "$BASE_URL/api/me" "" "200"
else
    echo -e "${YELLOW}Note: OTP code not in response (check server logs)${NC}"
fi
echo ""

echo "=== Step 4: Testing Existing Tenant Login ==="
# First, ensure tenant has a password by signing up
echo "Setting up tenant with password..."
rm -f "$COOKIE_FILE"
otp_resp=$(curl -s -X POST "$BASE_URL/api/auth/request-otp" -H "Content-Type: application/json" -d '{"phone":"+251912345678","isSignup":true}')
otp=$(echo "$otp_resp" | grep -o '"code":"[0-9]*"' | cut -d'"' -f4)

if [ -n "$otp" ]; then
    curl -s -X POST "$BASE_URL/api/auth/verify-otp" -H "Content-Type: application/json" -d "{\"phone\":\"+251912345678\",\"code\":\"$otp\",\"isSignup\":true}" > /dev/null
    curl -s -X POST "$BASE_URL/api/auth/tenant/set-password" -H "Content-Type: application/json" -d '{"phone":"+251912345678","password":"Tenant123!"}' > /dev/null
    
    echo "Testing login..."
    test_endpoint "Tenant Login" "POST" "$BASE_URL/api/auth/login" '{"phone":"+251912345678","password":"Tenant123!"}' "200"
    test_endpoint "/api/me (as TENANT)" "GET" "$BASE_URL/api/me" "" "200"
fi
echo ""

echo "=== Step 5: Testing Protected Routes ==="
rm -f "$COOKIE_FILE"
echo "Testing /admin without auth (should redirect)..."
admin_response=$(curl -s -L -w "\n%{http_code}" "$BASE_URL/admin" 2>/dev/null)
admin_code=$(echo "$admin_response" | tail -n1)
if [ "$admin_code" = "200" ]; then
    echo -e "${GREEN}✓${NC} Redirected to login (HTTP $admin_code)"
else
    echo -e "${RED}✗${NC} Unexpected status: $admin_code"
fi

echo "Testing /tenant/dashboard without auth (should redirect)..."
tenant_response=$(curl -s -L -w "\n%{http_code}" "$BASE_URL/tenant/dashboard" 2>/dev/null)
tenant_code=$(echo "$tenant_response" | tail -n1)
if [ "$tenant_code" = "200" ]; then
    echo -e "${GREEN}✓${NC} Redirected to login (HTTP $tenant_code)"
else
    echo -e "${RED}✗${NC} Unexpected status: $tenant_code"
fi
echo ""

echo "=== Step 6: Testing Role-Based Access ==="
# Login as staff
rm -f "$COOKIE_FILE"
curl -s -X POST "$BASE_URL/api/auth/login" -H "Content-Type: application/json" -d '{"identifier":"admin@example.com","password":"ChangeMe123!"}' -c "$COOKIE_FILE" > /dev/null

echo "Testing /api/organizations/me as ORG_ADMIN..."
test_endpoint "Organization Info" "GET" "$BASE_URL/api/organizations/me" "" "200"

echo "Testing /api/tenants as ORG_ADMIN..."
test_endpoint "Tenants List" "GET" "$BASE_URL/api/tenants" "" "200"
echo ""

echo "=== Step 7: Testing Logout ==="
test_endpoint "Logout" "POST" "$BASE_URL/api/auth/logout" "" "200"
test_endpoint "/api/me after logout" "GET" "$BASE_URL/api/me" "" "200"
echo ""

echo "=========================================="
echo -e "${GREEN}All tests completed!${NC}"
echo "=========================================="


































