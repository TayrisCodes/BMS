#!/bin/bash

# Test script for Phase 5 Step 1 - Dashboard Enhancements
# Tests admin dashboard, org dashboard, and building manager dashboard APIs
# Make sure the dev server is running: npm run dev

BASE_URL="http://localhost:3000"
SESSION_COOKIE="bms_session"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Phase 5 Step 1 - Dashboard Enhancements Test Script ===${NC}\n"

# Check if server is running
if ! curl -s "$BASE_URL/api/health" > /dev/null 2>&1; then
  echo -e "${RED}❌ Server is not running at $BASE_URL${NC}"
  echo -e "${YELLOW}Please start the dev server with: npm run dev${NC}"
  exit 1
fi

# ============================================
# Test 1: Admin Dashboard APIs (SUPER_ADMIN)
# ============================================
echo -e "${YELLOW}=== Test 1: Admin Dashboard APIs (SUPER_ADMIN) ===${NC}\n"

# Step 1.1: Login as SUPER_ADMIN
echo -e "${YELLOW}Step 1.1: Logging in as SUPER_ADMIN...${NC}"
SUPER_ADMIN_LOGIN=$(curl -s -c /tmp/bms_super_admin_cookies.txt -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"identifier": "superadmin@example.com", "password": "ChangeMe123!"}')

echo "$SUPER_ADMIN_LOGIN"

SUPER_ADMIN_SESSION=$(grep "$SESSION_COOKIE" /tmp/bms_super_admin_cookies.txt | awk '{print $7}')

if [ -z "$SUPER_ADMIN_SESSION" ]; then
  echo -e "${RED}❌ Failed to get SUPER_ADMIN session token${NC}"
  echo -e "${YELLOW}Trying ORG_ADMIN instead...${NC}"
  
  ORG_ADMIN_LOGIN=$(curl -s -c /tmp/bms_org_admin_cookies.txt -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"identifier": "admin@example.com", "password": "ChangeMe123!"}')
  
  ORG_ADMIN_SESSION=$(grep "$SESSION_COOKIE" /tmp/bms_org_admin_cookies.txt | awk '{print $7}')
  
  if [ -z "$ORG_ADMIN_SESSION" ]; then
    echo -e "${RED}❌ Failed to get any admin session token${NC}"
    exit 1
  fi
  
  SUPER_ADMIN_SESSION=$ORG_ADMIN_SESSION
  rm -f /tmp/bms_super_admin_cookies.txt
  mv /tmp/bms_org_admin_cookies.txt /tmp/bms_super_admin_cookies.txt
fi

echo -e "${GREEN}✅ Admin session token obtained${NC}\n"

# Step 1.2: Test GET /api/organizations
echo -e "${YELLOW}Step 1.2: GET /api/organizations (List organizations)...${NC}"
ORGS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/organizations" \
  -b "$SESSION_COOKIE=$SUPER_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -w "\nHTTP_STATUS:%{http_code}")

HTTP_STATUS=$(echo "$ORGS_RESPONSE" | grep "HTTP_STATUS" | cut -d':' -f2)
ORGS_BODY=$(echo "$ORGS_RESPONSE" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS" = "200" ]; then
  echo -e "${GREEN}✅ GET /api/organizations - Success${NC}"
  echo "$ORGS_BODY" | head -20
else
  echo -e "${RED}❌ GET /api/organizations - Failed (Status: $HTTP_STATUS)${NC}"
  echo "$ORGS_BODY"
fi
echo ""

# Step 1.3: Test GET /api/users
echo -e "${YELLOW}Step 1.3: GET /api/users (List users)...${NC}"
USERS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/users" \
  -b "$SESSION_COOKIE=$SUPER_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -w "\nHTTP_STATUS:%{http_code}")

HTTP_STATUS=$(echo "$USERS_RESPONSE" | grep "HTTP_STATUS" | cut -d':' -f2)
USERS_BODY=$(echo "$USERS_RESPONSE" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS" = "200" ]; then
  echo -e "${GREEN}✅ GET /api/users - Success${NC}"
  echo "$USERS_BODY" | head -20
else
  echo -e "${RED}❌ GET /api/users - Failed (Status: $HTTP_STATUS)${NC}"
  echo "$USERS_BODY"
fi
echo ""

# Step 1.4: Test GET /api/dashboard/charts/revenue
echo -e "${YELLOW}Step 1.4: GET /api/dashboard/charts/revenue (Revenue trends)...${NC}"
REVENUE_RESPONSE=$(curl -s -X GET "$BASE_URL/api/dashboard/charts/revenue?months=6" \
  -b "$SESSION_COOKIE=$SUPER_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -w "\nHTTP_STATUS:%{http_code}")

HTTP_STATUS=$(echo "$REVENUE_RESPONSE" | grep "HTTP_STATUS" | cut -d':' -f2)
REVENUE_BODY=$(echo "$REVENUE_RESPONSE" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS" = "200" ]; then
  echo -e "${GREEN}✅ GET /api/dashboard/charts/revenue - Success${NC}"
  echo "$REVENUE_BODY" | head -20
else
  echo -e "${RED}❌ GET /api/dashboard/charts/revenue - Failed (Status: $HTTP_STATUS)${NC}"
  echo "$REVENUE_BODY"
fi
echo ""

# ============================================
# Test 2: Org Dashboard APIs (ORG_ADMIN)
# ============================================
echo -e "${YELLOW}=== Test 2: Org Dashboard APIs (ORG_ADMIN) ===${NC}\n"

# Step 2.1: Login as ORG_ADMIN
echo -e "${YELLOW}Step 2.1: Logging in as ORG_ADMIN...${NC}"
ORG_ADMIN_LOGIN=$(curl -s -c /tmp/bms_org_admin_cookies.txt -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"identifier": "admin@example.com", "password": "ChangeMe123!"}')

echo "$ORG_ADMIN_LOGIN"

ORG_ADMIN_SESSION=$(grep "$SESSION_COOKIE" /tmp/bms_org_admin_cookies.txt | awk '{print $7}')

if [ -z "$ORG_ADMIN_SESSION" ]; then
  echo -e "${RED}❌ Failed to get ORG_ADMIN session token${NC}"
  exit 1
fi

echo -e "${GREEN}✅ ORG_ADMIN session token obtained${NC}\n"

# Step 2.2: Test GET /api/dashboard/charts/occupancy
echo -e "${YELLOW}Step 2.2: GET /api/dashboard/charts/occupancy (Occupancy trends)...${NC}"
OCCUPANCY_RESPONSE=$(curl -s -X GET "$BASE_URL/api/dashboard/charts/occupancy?months=6" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -w "\nHTTP_STATUS:%{http_code}")

HTTP_STATUS=$(echo "$OCCUPANCY_RESPONSE" | grep "HTTP_STATUS" | cut -d':' -f2)
OCCUPANCY_BODY=$(echo "$OCCUPANCY_RESPONSE" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS" = "200" ]; then
  echo -e "${GREEN}✅ GET /api/dashboard/charts/occupancy - Success${NC}"
  echo "$OCCUPANCY_BODY" | head -20
else
  echo -e "${RED}❌ GET /api/dashboard/charts/occupancy - Failed (Status: $HTTP_STATUS)${NC}"
  echo "$OCCUPANCY_BODY"
fi
echo ""

# Step 2.3: Test GET /api/dashboard/charts/revenue (org-scoped)
echo -e "${YELLOW}Step 2.3: GET /api/dashboard/charts/revenue (Org-scoped revenue)...${NC}"
ORG_REVENUE_RESPONSE=$(curl -s -X GET "$BASE_URL/api/dashboard/charts/revenue?months=6" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -w "\nHTTP_STATUS:%{http_code}")

HTTP_STATUS=$(echo "$ORG_REVENUE_RESPONSE" | grep "HTTP_STATUS" | cut -d':' -f2)
ORG_REVENUE_BODY=$(echo "$ORG_REVENUE_RESPONSE" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS" = "200" ]; then
  echo -e "${GREEN}✅ GET /api/dashboard/charts/revenue (org-scoped) - Success${NC}"
  echo "$ORG_REVENUE_BODY" | head -20
else
  echo -e "${RED}❌ GET /api/dashboard/charts/revenue (org-scoped) - Failed (Status: $HTTP_STATUS)${NC}"
  echo "$ORG_REVENUE_BODY"
fi
echo ""

# Step 2.4: Test other org dashboard endpoints
echo -e "${YELLOW}Step 2.4: Testing other org dashboard endpoints...${NC}"

ENDPOINTS=(
  "/api/leases?limit=10"
  "/api/tenants?limit=10"
  "/api/complaints?limit=10"
  "/api/payments?limit=10"
)

for endpoint in "${ENDPOINTS[@]}"; do
  echo -e "${YELLOW}  Testing GET $endpoint...${NC}"
  RESPONSE=$(curl -s -X GET "$BASE_URL$endpoint" \
    -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
    -H "Content-Type: application/json" \
    -w "\nHTTP_STATUS:%{http_code}")
  
  HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d':' -f2)
  
  if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${GREEN}  ✅ GET $endpoint - Success${NC}"
  else
    echo -e "${RED}  ❌ GET $endpoint - Failed (Status: $HTTP_STATUS)${NC}"
  fi
done
echo ""

# ============================================
# Test 3: Building Manager Dashboard APIs
# ============================================
echo -e "${YELLOW}=== Test 3: Building Manager Dashboard APIs ===${NC}\n"

# Step 3.1: Get a building ID
echo -e "${YELLOW}Step 3.1: Getting a building ID...${NC}"
LIST_BUILDINGS=$(curl -s -X GET "$BASE_URL/api/buildings?status=active" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")

BUILDING_ID=$(echo "$LIST_BUILDINGS" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$BUILDING_ID" ]; then
  echo -e "${YELLOW}⚠️  No building found, creating one...${NC}"
  CREATE_BUILDING=$(curl -s -X POST "$BASE_URL/api/buildings" \
    -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Test Building for Dashboard",
      "address": {
        "street": "Test Street",
        "city": "Addis Ababa"
      },
      "buildingType": "residential",
      "totalFloors": 3,
      "totalUnits": 10,
      "status": "active"
    }')
  BUILDING_ID=$(echo "$CREATE_BUILDING" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
fi

if [ -z "$BUILDING_ID" ]; then
  echo -e "${RED}❌ Failed to get or create building${NC}"
  echo -e "${YELLOW}Skipping building manager dashboard tests...${NC}\n"
else
  echo -e "${GREEN}✅ Building ID: $BUILDING_ID${NC}\n"

  # Step 3.2: Test GET /api/buildings/[id]
  echo -e "${YELLOW}Step 3.2: GET /api/buildings/$BUILDING_ID (Get building details)...${NC}"
  BUILDING_RESPONSE=$(curl -s -X GET "$BASE_URL/api/buildings/$BUILDING_ID" \
    -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
    -H "Content-Type: application/json" \
    -w "\nHTTP_STATUS:%{http_code}")
  
  HTTP_STATUS=$(echo "$BUILDING_RESPONSE" | grep "HTTP_STATUS" | cut -d':' -f2)
  BUILDING_BODY=$(echo "$BUILDING_RESPONSE" | sed '/HTTP_STATUS/d')
  
  if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ GET /api/buildings/$BUILDING_ID - Success${NC}"
    echo "$BUILDING_BODY" | head -10
  else
    echo -e "${RED}❌ GET /api/buildings/$BUILDING_ID - Failed (Status: $HTTP_STATUS)${NC}"
    echo "$BUILDING_BODY"
  fi
  echo ""

  # Step 3.3: Test GET /api/buildings/[id]/stats
  echo -e "${YELLOW}Step 3.3: GET /api/buildings/$BUILDING_ID/stats (Get building stats)...${NC}"
  STATS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/buildings/$BUILDING_ID/stats" \
    -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
    -H "Content-Type: application/json" \
    -w "\nHTTP_STATUS:%{http_code}")
  
  HTTP_STATUS=$(echo "$STATS_RESPONSE" | grep "HTTP_STATUS" | cut -d':' -f2)
  STATS_BODY=$(echo "$STATS_RESPONSE" | sed '/HTTP_STATUS/d')
  
  if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ GET /api/buildings/$BUILDING_ID/stats - Success${NC}"
    echo "$STATS_BODY" | head -10
  else
    echo -e "${RED}❌ GET /api/buildings/$BUILDING_ID/stats - Failed (Status: $HTTP_STATUS)${NC}"
    echo "$STATS_BODY"
  fi
  echo ""

  # Step 3.4: Test GET /api/work-orders?buildingId=[id]
  echo -e "${YELLOW}Step 3.4: GET /api/work-orders?buildingId=$BUILDING_ID (Get building work orders)...${NC}"
  WORK_ORDERS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/work-orders?buildingId=$BUILDING_ID&limit=10" \
    -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
    -H "Content-Type: application/json" \
    -w "\nHTTP_STATUS:%{http_code}")
  
  HTTP_STATUS=$(echo "$WORK_ORDERS_RESPONSE" | grep "HTTP_STATUS" | cut -d':' -f2)
  WORK_ORDERS_BODY=$(echo "$WORK_ORDERS_RESPONSE" | sed '/HTTP_STATUS/d')
  
  if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ GET /api/work-orders?buildingId=$BUILDING_ID - Success${NC}"
    echo "$WORK_ORDERS_BODY" | head -10
  else
    echo -e "${RED}❌ GET /api/work-orders?buildingId=$BUILDING_ID - Failed (Status: $HTTP_STATUS)${NC}"
    echo "$WORK_ORDERS_BODY"
  fi
  echo ""

  # Step 3.5: Test GET /api/complaints?buildingId=[id]
  echo -e "${YELLOW}Step 3.5: GET /api/complaints?buildingId=$BUILDING_ID (Get building complaints)...${NC}"
  COMPLAINTS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/complaints?buildingId=$BUILDING_ID&limit=10" \
    -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
    -H "Content-Type: application/json" \
    -w "\nHTTP_STATUS:%{http_code}")
  
  HTTP_STATUS=$(echo "$COMPLAINTS_RESPONSE" | grep "HTTP_STATUS" | cut -d':' -f2)
  COMPLAINTS_BODY=$(echo "$COMPLAINTS_RESPONSE" | sed '/HTTP_STATUS/d')
  
  if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ GET /api/complaints?buildingId=$BUILDING_ID - Success${NC}"
    echo "$COMPLAINTS_BODY" | head -10
  else
    echo -e "${RED}❌ GET /api/complaints?buildingId=$BUILDING_ID - Failed (Status: $HTTP_STATUS)${NC}"
    echo "$COMPLAINTS_BODY"
  fi
  echo ""

  # Step 3.6: Test GET /api/dashboard/charts/revenue?buildingId=[id]
  echo -e "${YELLOW}Step 3.6: GET /api/dashboard/charts/revenue?buildingId=$BUILDING_ID (Get building revenue chart)...${NC}"
  BUILDING_REVENUE_RESPONSE=$(curl -s -X GET "$BASE_URL/api/dashboard/charts/revenue?buildingId=$BUILDING_ID&months=6" \
    -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
    -H "Content-Type: application/json" \
    -w "\nHTTP_STATUS:%{http_code}")
  
  HTTP_STATUS=$(echo "$BUILDING_REVENUE_RESPONSE" | grep "HTTP_STATUS" | cut -d':' -f2)
  BUILDING_REVENUE_BODY=$(echo "$BUILDING_REVENUE_RESPONSE" | sed '/HTTP_STATUS/d')
  
  if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ GET /api/dashboard/charts/revenue?buildingId=$BUILDING_ID - Success${NC}"
    echo "$BUILDING_REVENUE_BODY" | head -10
  else
    echo -e "${RED}❌ GET /api/dashboard/charts/revenue?buildingId=$BUILDING_ID - Failed (Status: $HTTP_STATUS)${NC}"
    echo "$BUILDING_REVENUE_BODY"
  fi
  echo ""
fi

echo -e "${GREEN}=== All Phase 5 Step 1 dashboard tests completed! ===${NC}"

# Cleanup
rm -f /tmp/bms_super_admin_cookies.txt
rm -f /tmp/bms_org_admin_cookies.txt



















