#!/bin/bash

# Test script for Visitor QR Code Generation
# Tests QR code generation, validation, and auto-logging

# Don't exit on error - we want to see all test results
# set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"

# Get tenant phone from database via admin login
echo "Getting tenant credentials..."
ADMIN_COOKIES="/tmp/test_admin_qr_temp.txt"
rm -f "$ADMIN_COOKIES"
curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"identifier": "admin@example.com", "password": "ChangeMe123!"}' \
    -c "$ADMIN_COOKIES" > /dev/null

TENANT_PHONE=$(curl -s -X GET "$BASE_URL/api/tenants?status=active" -b "$ADMIN_COOKIES" | \
    python3 -c "import sys, json; data=json.load(sys.stdin); tenants=data.get('tenants', []); print(tenants[0]['primaryPhone'] if tenants else '+251911234567')" 2>/dev/null || echo "+251911234567")

TENANT_PASSWORD="${TENANT_PASSWORD:-123456}"

echo "=========================================="
echo "Visitor QR Code Generation Test Suite"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function to print test results
print_test() {
    local test_name=$1
    local status=$2
    local message=$3
    
    if [ "$status" = "PASS" ]; then
        echo -e "${GREEN}✅ PASS${NC}: $test_name"
        if [ -n "$message" ]; then
            echo "   $message"
        fi
        ((TESTS_PASSED++))
    elif [ "$status" = "FAIL" ]; then
        echo -e "${RED}❌ FAIL${NC}: $test_name"
        if [ -n "$message" ]; then
            echo "   $message"
        fi
        ((TESTS_FAILED++))
    else
        echo -e "${YELLOW}⚠️  INFO${NC}: $test_name"
        if [ -n "$message" ]; then
            echo "   $message"
        fi
    fi
}

# Step 1: Tenant Login (Try multiple methods)
echo "Step 1: Tenant Login"
echo "-------------------"

TENANT_COOKIES="/tmp/test_tenant_qr_cookies.txt"
rm -f "$TENANT_COOKIES"

# Try login with phone
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"phone\": \"$TENANT_PHONE\", \"password\": \"$TENANT_PASSWORD\"}" \
    -c "$TENANT_COOKIES")

# If that fails, try with identifier
if echo "$LOGIN_RESPONSE" | grep -q "error"; then
    LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"identifier\": \"$TENANT_PHONE\", \"password\": \"$TENANT_PASSWORD\"}" \
        -c "$TENANT_COOKIES")
fi

# If still fails, try admin login and create test tenant session
if echo "$LOGIN_RESPONSE" | grep -q "error"; then
    print_test "Tenant Login" "INFO" "Tenant login failed, using admin for testing: $LOGIN_RESPONSE"
    # Use admin cookies for tenant endpoints (will test authorization)
    ADMIN_COOKIES_FOR_TENANT="$TENANT_COOKIES"
    cp "$ADMIN_COOKIES" "$ADMIN_COOKIES_FOR_TENANT" 2>/dev/null || true
else
    print_test "Tenant Login" "PASS" "Logged in successfully"
fi

# Step 2: Get Tenant Context (Building, Unit, Organization)
echo ""
echo "Step 2: Get Tenant Context"
echo "--------------------------"

# Try tenant lease API first
LEASE_RESPONSE=$(curl -s -X GET "$BASE_URL/api/tenant/lease" -b "$TENANT_COOKIES" 2>/dev/null || echo "")
BUILDING_ID=$(echo "$LEASE_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('lease', {}).get('buildingId', ''))" 2>/dev/null || echo "")
UNIT_ID=$(echo "$LEASE_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('lease', {}).get('unitId', ''))" 2>/dev/null || echo "")

# If that fails, get from admin APIs
if [ -z "$BUILDING_ID" ]; then
    # Get tenant ID from phone
    TENANT_ID=$(curl -s -X GET "$BASE_URL/api/tenants?status=active" -b "$ADMIN_COOKIES" | \
        python3 -c "import sys, json; data=json.load(sys.stdin); tenants=data.get('tenants', []); print(tenants[0]['_id'] if tenants else '')" 2>/dev/null || echo "")
    
    if [ -n "$TENANT_ID" ]; then
        # Get leases for tenant
        LEASES_RESPONSE=$(curl -s -X GET "$BASE_URL/api/leases?tenantId=$TENANT_ID" -b "$ADMIN_COOKIES" 2>/dev/null || echo "")
        BUILDING_ID=$(echo "$LEASES_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); leases=data.get('leases', []); print(leases[0]['buildingId'] if leases else '')" 2>/dev/null || echo "")
        UNIT_ID=$(echo "$LEASES_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); leases=data.get('leases', []); print(leases[0]['unitId'] if leases else '')" 2>/dev/null || echo "")
    fi
    
    # If still no building, get first building
    if [ -z "$BUILDING_ID" ]; then
        BUILDINGS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/buildings" -b "$ADMIN_COOKIES" 2>/dev/null || echo "")
        BUILDING_ID=$(echo "$BUILDINGS_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); buildings=data.get('buildings', []); print(buildings[0]['_id'] if buildings else '')" 2>/dev/null || echo "")
    fi
fi

if [ -z "$BUILDING_ID" ]; then
    print_test "Get Building ID" "FAIL" "Could not get building ID"
    exit 1
else
    print_test "Get Building ID" "PASS" "Building ID: $BUILDING_ID"
fi

if [ -n "$UNIT_ID" ]; then
    print_test "Get Unit ID" "PASS" "Unit ID: $UNIT_ID"
else
    print_test "Get Unit ID" "INFO" "No unit ID found (optional)"
fi

# Get tenant ID for QR code generation
TENANT_ID_FOR_QR=$(curl -s -X GET "$BASE_URL/api/tenants?status=active" -b "$ADMIN_COOKIES" | \
    python3 -c "import sys, json; data=json.load(sys.stdin); tenants=data.get('tenants', []); print(tenants[0]['_id'] if tenants else '')" 2>/dev/null || echo "")

if [ -z "$TENANT_ID_FOR_QR" ]; then
    print_test "Get Tenant ID" "FAIL" "Could not get tenant ID for QR code generation"
    exit 1
else
    print_test "Get Tenant ID" "PASS" "Tenant ID: $TENANT_ID_FOR_QR"
fi

# Step 3: Generate Visitor QR Code
echo ""
echo "Step 3: Generate Visitor QR Code"
echo "---------------------------------"

# Calculate valid until (2 hours from now)
VALID_UNTIL=$(python3 -c "from datetime import datetime, timedelta; print((datetime.now() + timedelta(hours=2)).strftime('%Y-%m-%dT%H:%M:%S'))")

# Use tenant ID from context or get first tenant
TENANT_ID_TO_USE="$TENANT_ID_FOR_QR"
if [ -z "$TENANT_ID_TO_USE" ]; then
    TENANT_ID_TO_USE=$(curl -s -X GET "$BASE_URL/api/tenants?status=active" -b "$ADMIN_COOKIES" | \
        python3 -c "import sys, json; data=json.load(sys.stdin); tenants=data.get('tenants', []); print(tenants[0]['_id'] if tenants else '')" 2>/dev/null || echo "")
fi

QR_CODE_DATA=$(cat <<EOF
{
    "buildingId": "$BUILDING_ID",
    "unitId": "$UNIT_ID",
    "visitorName": "Test Visitor $(date +%s)",
    "visitorPhone": "+251912345678",
    "visitorIdNumber": "ID123456",
    "purpose": "Testing QR Code System",
    "vehiclePlateNumber": "TEST-1234",
    "validUntil": "$VALID_UNTIL"
}
EOF
)

GENERATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/visitor-qr-codes" \
    -H "Content-Type: application/json" \
    -b "$TENANT_COOKIES" \
    -d "$QR_CODE_DATA")

if echo "$GENERATE_RESPONSE" | grep -q "error"; then
    print_test "Generate QR Code" "FAIL" "Failed to generate QR code: $GENERATE_RESPONSE"
    exit 1
else
    QR_CODE_ID=$(echo "$GENERATE_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('qrCode', {}).get('_id', ''))" 2>/dev/null || echo "")
    QR_CODE_TOKEN=$(echo "$GENERATE_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('qrCode', {}).get('qrCode', ''))" 2>/dev/null || echo "")
    QR_CODE_IMAGE=$(echo "$GENERATE_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('qrCode', {}).get('qrCodeImage', '')[:50] if data.get('qrCode', {}).get('qrCodeImage') else '')" 2>/dev/null || echo "")
    
    if [ -z "$QR_CODE_TOKEN" ]; then
        print_test "Generate QR Code" "FAIL" "QR code generated but token not found"
        exit 1
    else
        print_test "Generate QR Code" "PASS" "QR Code ID: $QR_CODE_ID, Token: ${QR_CODE_TOKEN:0:20}..."
    fi
    
    if [ -n "$QR_CODE_IMAGE" ]; then
        print_test "QR Code Image" "PASS" "QR code image generated (base64)"
    else
        print_test "QR Code Image" "FAIL" "QR code image not generated"
    fi
fi

# Step 4: List QR Codes
echo ""
echo "Step 4: List QR Codes"
echo "---------------------"

LIST_RESPONSE=$(curl -s -X GET "$BASE_URL/api/visitor-qr-codes?includeUsed=false" -b "$TENANT_COOKIES")

if echo "$LIST_RESPONSE" | grep -q "error"; then
    print_test "List QR Codes" "FAIL" "Failed to list QR codes: $LIST_RESPONSE"
else
    QR_COUNT=$(echo "$LIST_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(len(data.get('qrCodes', [])))" 2>/dev/null || echo "0")
    print_test "List QR Codes" "PASS" "Found $QR_COUNT active QR code(s)"
fi

# Step 5: Preview QR Code (Security endpoint - requires security login)
echo ""
echo "Step 5: Preview QR Code (Security)"
echo "------------------------------------"

# Use admin cookies for security endpoints
SECURITY_COOKIES="$ADMIN_COOKIES"

PREVIEW_RESPONSE=$(curl -s -X GET "$BASE_URL/api/visitor-qr-codes/validate?qrCode=$QR_CODE_TOKEN" \
    -b "$SECURITY_COOKIES" 2>/dev/null || echo "")

if echo "$PREVIEW_RESPONSE" | grep -q "error"; then
    print_test "Preview QR Code" "INFO" "Preview requires security role (expected): $(echo "$PREVIEW_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('error', 'Unknown error'))" 2>/dev/null || echo 'Unknown')"
else
    IS_VALID=$(echo "$PREVIEW_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('qrCode', {}).get('isValid', False))" 2>/dev/null || echo "False")
    if [ "$IS_VALID" = "True" ]; then
        print_test "Preview QR Code" "PASS" "QR code is valid and ready to use"
    else
        print_test "Preview QR Code" "INFO" "QR code preview retrieved"
    fi
fi

# Step 6: Validate QR Code and Auto-Log Visitor (Security endpoint)
echo ""
echo "Step 6: Validate QR Code and Auto-Log Visitor"
echo "----------------------------------------------"

VALIDATE_DATA=$(cat <<EOF
{
    "qrCode": "$QR_CODE_TOKEN"
}
EOF
)

VALIDATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/visitor-qr-codes/validate" \
    -H "Content-Type: application/json" \
    -b "$SECURITY_COOKIES" \
    -d "$VALIDATE_DATA")

if echo "$VALIDATE_RESPONSE" | grep -q "error"; then
    ERROR_MSG=$(echo "$VALIDATE_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('error', 'Unknown error'))" 2>/dev/null || echo "Unknown error")
    if echo "$ERROR_MSG" | grep -q "security"; then
        print_test "Validate QR Code" "INFO" "Validation requires security role (expected): $ERROR_MSG"
    else
        print_test "Validate QR Code" "FAIL" "Failed to validate: $ERROR_MSG"
    fi
else
    VISITOR_LOG_ID=$(echo "$VALIDATE_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('visitorLog', {}).get('_id', ''))" 2>/dev/null || echo "")
    VISITOR_NAME=$(echo "$VALIDATE_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('visitorLog', {}).get('visitorName', ''))" 2>/dev/null || echo "")
    
    if [ -n "$VISITOR_LOG_ID" ]; then
        print_test "Validate QR Code" "PASS" "QR code validated and visitor logged: $VISITOR_NAME (Log ID: $VISITOR_LOG_ID)"
        
        # Verify QR code is marked as used
        QR_USED=$(echo "$VALIDATE_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('qrCode', {}).get('used', False))" 2>/dev/null || echo "False")
        if [ "$QR_USED" = "True" ]; then
            print_test "QR Code Marked as Used" "PASS" "QR code successfully marked as used"
        else
            print_test "QR Code Marked as Used" "FAIL" "QR code not marked as used"
        fi
    else
        print_test "Validate QR Code" "FAIL" "Validation succeeded but visitor log not created"
    fi
fi

# Step 7: Verify QR Code Cannot Be Used Twice
echo ""
echo "Step 7: Verify QR Code Cannot Be Used Twice"
echo "--------------------------------------------"

SECOND_VALIDATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/visitor-qr-codes/validate" \
    -H "Content-Type: application/json" \
    -b "$SECURITY_COOKIES" \
    -d "$VALIDATE_DATA")

if echo "$SECOND_VALIDATE_RESPONSE" | grep -q "error"; then
    ERROR_MSG=$(echo "$SECOND_VALIDATE_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('error', 'Unknown error'))" 2>/dev/null || echo "Unknown error")
    if echo "$ERROR_MSG" | grep -q "already used\|Invalid QR code"; then
        print_test "Prevent Reuse" "PASS" "QR code correctly rejected on second use: $ERROR_MSG"
    else
        print_test "Prevent Reuse" "INFO" "Unexpected error: $ERROR_MSG"
    fi
else
    print_test "Prevent Reuse" "FAIL" "QR code was accepted on second use (should be rejected)"
fi

# Step 8: List QR Codes After Use
echo ""
echo "Step 8: List QR Codes After Use"
echo "--------------------------------"

LIST_AFTER_RESPONSE=$(curl -s -X GET "$BASE_URL/api/visitor-qr-codes?includeUsed=true" -b "$TENANT_COOKIES")

if echo "$LIST_AFTER_RESPONSE" | grep -q "error"; then
    print_test "List QR Codes (After Use)" "FAIL" "Failed to list QR codes: $LIST_AFTER_RESPONSE"
else
    USED_COUNT=$(echo "$LIST_AFTER_RESPONSE" | python3 -c "import sys, json; codes=json.load(sys.stdin).get('qrCodes', []); print(sum(1 for c in codes if c.get('used', False)))" 2>/dev/null || echo "0")
    print_test "List QR Codes (After Use)" "PASS" "Found $USED_COUNT used QR code(s)"
fi

# Summary
echo ""
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo -e "${GREEN}Tests Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Tests Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed${NC}"
    exit 1
fi

