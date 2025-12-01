#!/bin/bash

# BMS Test Accounts Seeding Script
# This script creates all test accounts for testing the BMS system

BASE_URL="http://localhost:3000"

echo "🌱 BMS Test Accounts Seeding Script"
echo "===================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Seed Organization
echo -e "${YELLOW}Step 1: Seeding Organization...${NC}"
ORG_RESPONSE=$(curl -s -X POST "$BASE_URL/api/organizations/seed" \
  -H "Content-Type: application/json")

if echo "$ORG_RESPONSE" | grep -q "already exists\|seeded"; then
  echo -e "${GREEN}✓ Organization ready${NC}"
  ORG_ID=$(echo "$ORG_RESPONSE" | grep -o '"organizationId":"[^"]*"' | cut -d'"' -f4)
  echo "  Organization ID: $ORG_ID"
else
  echo -e "${RED}✗ Failed to seed organization${NC}"
  echo "$ORG_RESPONSE"
  exit 1
fi

echo ""

# Step 2: Seed SUPER_ADMIN
echo -e "${YELLOW}Step 2: Seeding SUPER_ADMIN...${NC}"
SUPER_ADMIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/seed-super-admin" \
  -H "Content-Type: application/json")

if echo "$SUPER_ADMIN_RESPONSE" | grep -q "already exists\|seeded"; then
  echo -e "${GREEN}✓ SUPER_ADMIN ready${NC}"
  echo "  Email: superadmin@example.com"
  echo "  Phone: +19999999999"
  echo "  Password: SuperAdmin123!"
else
  echo -e "${RED}✗ Failed to seed SUPER_ADMIN${NC}"
  echo "$SUPER_ADMIN_RESPONSE"
fi

echo ""

# Step 3: Seed ORG_ADMIN
echo -e "${YELLOW}Step 3: Seeding ORG_ADMIN...${NC}"
ORG_ADMIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/seed-org-admin" \
  -H "Content-Type: application/json")

if echo "$ORG_ADMIN_RESPONSE" | grep -q "already exists\|seeded"; then
  echo -e "${GREEN}✓ ORG_ADMIN ready${NC}"
  echo "  Email: admin@example.com"
  echo "  Phone: +10000000000"
  echo "  Password: ChangeMe123!"
else
  echo -e "${RED}✗ Failed to seed ORG_ADMIN${NC}"
  echo "$ORG_ADMIN_RESPONSE"
fi

echo ""

# Step 4: Seed BUILDING_MANAGER
echo -e "${YELLOW}Step 4: Seeding BUILDING_MANAGER...${NC}"
BUILDING_MANAGER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/seed-building-manager" \
  -H "Content-Type: application/json")

if echo "$BUILDING_MANAGER_RESPONSE" | grep -q "already exists\|seeded"; then
  echo -e "${GREEN}✓ BUILDING_MANAGER ready${NC}"
  echo "  Email: building.manager@example.com"
  echo "  Phone: +10000000001"
  echo "  Password: BuildingManager123!"
else
  echo -e "${RED}✗ Failed to seed BUILDING_MANAGER${NC}"
  echo "$BUILDING_MANAGER_RESPONSE"
fi

echo ""

# Step 5: Seed Tenant
echo -e "${YELLOW}Step 5: Seeding Tenant...${NC}"
TENANT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/seed-tenant" \
  -H "Content-Type: application/json")

if echo "$TENANT_RESPONSE" | grep -q "already exists\|seeded"; then
  echo -e "${GREEN}✓ Tenant ready${NC}"
  echo "  Phone: +251912345678"
  echo "  (Use this phone for OTP login in tenant portal)"
else
  echo -e "${RED}✗ Failed to seed tenant${NC}"
  echo "$TENANT_RESPONSE"
fi

echo ""
echo -e "${GREEN}====================================${NC}"
echo -e "${GREEN}✅ Seeding Complete!${NC}"
echo -e "${GREEN}====================================${NC}"
echo ""
echo "📋 Test Accounts Created:"
echo ""
echo "1. SUPER_ADMIN (Platform Admin)"
echo "   Email: superadmin@example.com"
echo "   Phone: +19999999999"
echo "   Password: SuperAdmin123!"
echo ""
echo "2. ORG_ADMIN (Organization Admin)"
echo "   Email: admin@example.com"
echo "   Phone: +10000000000"
echo "   Password: ChangeMe123!"
echo ""
echo "3. BUILDING_MANAGER"
echo "   Email: building.manager@example.com"
echo "   Phone: +10000000001"
echo "   Password: BuildingManager123!"
echo ""
echo "4. TENANT (for Tenant Portal)"
echo "   Phone: +251912345678"
echo "   (Login via OTP at /tenant/login)"
echo ""
echo "🚀 You can now test the system!"
echo "   Login at: http://localhost:3000/login"





