#!/bin/bash

# Test script for Tenant CRUD API endpoints
# Make sure the dev server is running: npm run dev

BASE_URL="http://localhost:3000"
SESSION_COOKIE="bms_session"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== BMS Tenant API Test Script ===${NC}\n"

# Check if server is running
if ! curl -s "$BASE_URL/api/health" > /dev/null 2>&1; then
  echo -e "${RED}❌ Server is not running at $BASE_URL${NC}"
  echo -e "${YELLOW}Please start the dev server with: npm run dev${NC}"
  exit 1
fi

# Step 1: Seed SUPER_ADMIN (if not exists)
echo -e "${YELLOW}Step 1: Seeding SUPER_ADMIN...${NC}"
SEED_SUPER_ADMIN=$(curl -s -X POST "$BASE_URL/api/auth/seed-super-admin" \
  -H "Content-Type: application/json")
echo "$SEED_SUPER_ADMIN"
echo ""

# Step 2: Login as SUPER_ADMIN to get session
echo -e "${YELLOW}Step 2: Logging in as SUPER_ADMIN...${NC}"
LOGIN_RESPONSE=$(curl -s -c /tmp/bms_cookies.txt -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"identifier": "superadmin@example.com", "password": "SuperAdmin123!"}')

echo "$LOGIN_RESPONSE"

# Extract session cookie
SESSION_TOKEN=$(grep "$SESSION_COOKIE" /tmp/bms_cookies.txt | awk '{print $7}')

if [ -z "$SESSION_TOKEN" ]; then
  echo -e "${RED}❌ Failed to get session token${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Session token obtained${NC}\n"

# Step 3: Seed organization (if not exists) - doesn't require auth
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

# Step 4: Ensure indexes (using SUPER_ADMIN session)
echo -e "${YELLOW}Step 4: Ensuring database indexes...${NC}"
ENSURE_INDEXES=$(curl -s -X POST "$BASE_URL/api/admin/ensure-indexes" \
  -b "$SESSION_COOKIE=$SESSION_TOKEN" \
  -H "Content-Type: application/json")
echo "$ENSURE_INDEXES"
echo ""

# Step 5: Seed ORG_ADMIN user (using SUPER_ADMIN session)
echo -e "${YELLOW}Step 5: Seeding ORG_ADMIN user...${NC}"
SEED_ORG_ADMIN=$(curl -s -X POST "$BASE_URL/api/auth/seed-org-admin" \
  -b "$SESSION_COOKIE=$SESSION_TOKEN" \
  -H "Content-Type: application/json")
echo "$SEED_ORG_ADMIN"
echo ""

# Step 6: Login as ORG_ADMIN
echo -e "${YELLOW}Step 6: Logging in as ORG_ADMIN...${NC}"
ORG_ADMIN_LOGIN=$(curl -s -c /tmp/bms_orgadmin_cookies.txt -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"identifier": "admin@example.com", "password": "ChangeMe123!"}')

echo "$ORG_ADMIN_LOGIN"

ORG_ADMIN_SESSION=$(grep "$SESSION_COOKIE" /tmp/bms_orgadmin_cookies.txt | awk '{print $7}')

if [ -z "$ORG_ADMIN_SESSION" ]; then
  echo -e "${RED}❌ Failed to get ORG_ADMIN session token${NC}"
  exit 1
fi

echo -e "${GREEN}✅ ORG_ADMIN session token obtained${NC}\n"

# Step 7: Test GET /api/tenants (List tenants - should be empty)
echo -e "${YELLOW}Step 7: GET /api/tenants (List tenants)...${NC}"
LIST_TENANTS=$(curl -s -X GET "$BASE_URL/api/tenants" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$LIST_TENANTS"
echo ""

# Step 8: Test POST /api/tenants (Create tenant)
echo -e "${YELLOW}Step 8: POST /api/tenants (Create tenant)...${NC}"
CREATE_TENANT=$(curl -s -X POST "$BASE_URL/api/tenants" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "primaryPhone": "+251911234567",
    "email": "john.doe@example.com",
    "nationalId": "ET-1234567890",
    "language": "en",
    "status": "active",
    "emergencyContact": {
      "name": "Jane Doe",
      "phone": "+251912345678"
    },
    "notes": "Test tenant created via API"
  }')

echo "$CREATE_TENANT"

TENANT_ID=$(echo "$CREATE_TENANT" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -z "$TENANT_ID" ]; then
  echo -e "${RED}❌ Failed to create tenant${NC}"
  echo -e "${YELLOW}Response: $CREATE_TENANT${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Tenant created with ID: $TENANT_ID${NC}\n"

# Step 9: Test GET /api/tenants/[id] (Get single tenant)
echo -e "${YELLOW}Step 9: GET /api/tenants/$TENANT_ID (Get single tenant)...${NC}"
GET_TENANT=$(curl -s -X GET "$BASE_URL/api/tenants/$TENANT_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$GET_TENANT"
echo ""

# Step 10: Test GET /api/tenants with search
echo -e "${YELLOW}Step 10: GET /api/tenants?search=John (Search tenants)...${NC}"
SEARCH_TENANTS=$(curl -s -X GET "$BASE_URL/api/tenants?search=John" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$SEARCH_TENANTS"
echo ""

# Step 11: Test PATCH /api/tenants/[id] (Update tenant)
echo -e "${YELLOW}Step 11: PATCH /api/tenants/$TENANT_ID (Update tenant)...${NC}"
UPDATE_TENANT=$(curl -s -X PATCH "$BASE_URL/api/tenants/$TENANT_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John Updated",
    "notes": "Updated notes via API"
  }')
echo "$UPDATE_TENANT"
echo ""

# Step 12: Test GET /api/tenants/[id] again (Verify update)
echo -e "${YELLOW}Step 12: GET /api/tenants/$TENANT_ID (Verify update)...${NC}"
GET_UPDATED_TENANT=$(curl -s -X GET "$BASE_URL/api/tenants/$TENANT_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$GET_UPDATED_TENANT"
echo ""

# Step 13: Test DELETE /api/tenants/[id] (Soft delete)
echo -e "${YELLOW}Step 13: DELETE /api/tenants/$TENANT_ID (Soft delete tenant)...${NC}"
DELETE_TENANT=$(curl -s -X DELETE "$BASE_URL/api/tenants/$TENANT_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$DELETE_TENANT"
echo ""

# Step 14: Test GET /api/tenants/[id] again (Should still exist but with inactive status)
echo -e "${YELLOW}Step 14: GET /api/tenants/$TENANT_ID (Verify soft delete)...${NC}"
GET_DELETED_TENANT=$(curl -s -X GET "$BASE_URL/api/tenants/$TENANT_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$GET_DELETED_TENANT"

STATUS=$(echo "$GET_DELETED_TENANT" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
if [ "$STATUS" = "inactive" ]; then
  echo -e "${GREEN}✅ Tenant soft deleted successfully (status: inactive)${NC}"
else
  echo -e "${YELLOW}⚠️  Tenant status: $STATUS (expected: inactive)${NC}"
fi
echo ""

# Step 15: Test error cases - Create tenant with duplicate phone
echo -e "${YELLOW}Step 15: POST /api/tenants (Try to create duplicate phone - should fail)...${NC}"
DUPLICATE_TENANT=$(curl -s -X POST "$BASE_URL/api/tenants" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Jane",
    "lastName": "Smith",
    "primaryPhone": "+251911234567",
    "language": "en"
  }')
echo "$DUPLICATE_TENANT"
echo ""

# Step 16: Test GET /api/tenants?status=active
echo -e "${YELLOW}Step 16: GET /api/tenants?status=active (Filter by status)...${NC}"
FILTER_TENANTS=$(curl -s -X GET "$BASE_URL/api/tenants?status=active" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$FILTER_TENANTS"
echo ""

echo -e "${GREEN}=== All tests completed! ===${NC}"

# Cleanup
rm -f /tmp/bms_cookies.txt /tmp/bms_orgadmin_cookies.txt
