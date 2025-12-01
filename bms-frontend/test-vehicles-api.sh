#!/bin/bash

# Test script for Vehicles CRUD API endpoints
# Make sure the dev server is running: npm run dev

BASE_URL="http://localhost:3000"
SESSION_COOKIE="bms_session"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== BMS Vehicles API Test Script ===${NC}\n"

# Check if server is running
if ! curl -s "$BASE_URL/api/health" > /dev/null 2>&1; then
  echo -e "${RED}❌ Server is not running at $BASE_URL${NC}"
  echo -e "${YELLOW}Please start the dev server with: npm run dev${NC}"
  exit 1
fi

# Step 1: Login as ORG_ADMIN
echo -e "${YELLOW}Step 1: Logging in as ORG_ADMIN...${NC}"
ORG_ADMIN_LOGIN=$(curl -s -c /tmp/bms_vehicles_cookies.txt -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"identifier": "admin@example.com", "password": "ChangeMe123!"}')

echo "$ORG_ADMIN_LOGIN"

ORG_ADMIN_SESSION=$(grep "$SESSION_COOKIE" /tmp/bms_vehicles_cookies.txt | awk '{print $7}')

if [ -z "$ORG_ADMIN_SESSION" ]; then
  echo -e "${RED}❌ Failed to get ORG_ADMIN session token${NC}"
  exit 1
fi

echo -e "${GREEN}✅ ORG_ADMIN session token obtained${NC}\n"

# Step 2: Get or create a tenant
echo -e "${YELLOW}Step 2: Getting or creating a tenant...${NC}"

LIST_TENANTS=$(curl -s -X GET "$BASE_URL/api/tenants?status=active" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")

TENANT_ID=$(echo "$LIST_TENANTS" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$TENANT_ID" ]; then
  CREATE_TENANT=$(curl -s -X POST "$BASE_URL/api/tenants" \
    -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
    -H "Content-Type: application/json" \
    -d '{
      "firstName": "Test",
      "lastName": "Tenant",
      "primaryPhone": "+251911234567",
      "language": "en",
      "status": "active"
    }')
  TENANT_ID=$(echo "$CREATE_TENANT" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
fi

if [ -z "$TENANT_ID" ]; then
  echo -e "${RED}❌ Failed to get or create tenant${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Tenant ID: $TENANT_ID${NC}\n"

# Step 3: Get or create a parking space (optional, for testing parking space assignment)
echo -e "${YELLOW}Step 3: Getting or creating a parking space (optional)...${NC}"

LIST_BUILDINGS=$(curl -s -X GET "$BASE_URL/api/buildings?status=active" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")

BUILDING_ID=$(echo "$LIST_BUILDINGS" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ ! -z "$BUILDING_ID" ]; then
  LIST_SPACES=$(curl -s -X GET "$BASE_URL/api/parking-spaces?buildingId=$BUILDING_ID&status=available" \
    -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
    -H "Content-Type: application/json")

  PARKING_SPACE_ID=$(echo "$LIST_SPACES" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)

  if [ -z "$PARKING_SPACE_ID" ]; then
    CREATE_SPACE=$(curl -s -X POST "$BASE_URL/api/parking-spaces" \
      -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
      -H "Content-Type: application/json" \
      -d "{
        \"buildingId\": \"$BUILDING_ID\",
        \"spaceNumber\": \"V-001\",
        \"spaceType\": \"tenant\",
        \"status\": \"available\"
      }")
    PARKING_SPACE_ID=$(echo "$CREATE_SPACE" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
  fi

  if [ ! -z "$PARKING_SPACE_ID" ]; then
    echo -e "${GREEN}✅ Parking Space ID: $PARKING_SPACE_ID${NC}\n"
  fi
fi

# Step 4: Ensure indexes (using SUPER_ADMIN session)
echo -e "${YELLOW}Step 4: Ensuring database indexes...${NC}"
SUPER_ADMIN_LOGIN=$(curl -s -c /tmp/bms_vehicles_super_cookies.txt -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"identifier": "superadmin@bms.local", "password": "SuperAdmin123!"}')

SUPER_ADMIN_SESSION=$(grep "$SESSION_COOKIE" /tmp/bms_vehicles_super_cookies.txt | awk '{print $7}')

if [ ! -z "$SUPER_ADMIN_SESSION" ]; then
  ENSURE_INDEXES=$(curl -s -X POST "$BASE_URL/api/admin/ensure-indexes" \
    -b "$SESSION_COOKIE=$SUPER_ADMIN_SESSION" \
    -H "Content-Type: application/json")
  echo "$ENSURE_INDEXES"
  echo ""
fi

# Step 5: Test GET /api/vehicles (List vehicles - should be empty initially)
echo -e "${YELLOW}Step 5: GET /api/vehicles (List vehicles)...${NC}"
LIST_VEHICLES=$(curl -s -X GET "$BASE_URL/api/vehicles" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$LIST_VEHICLES"
echo ""

# Step 6: Test POST /api/vehicles (Create vehicle)
echo -e "${YELLOW}Step 6: POST /api/vehicles (Create vehicle)...${NC}"

CREATE_VEHICLE=$(curl -s -X POST "$BASE_URL/api/vehicles" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d "{
    \"tenantId\": \"$TENANT_ID\",
    \"plateNumber\": \"ABC-1234\",
    \"make\": \"Toyota\",
    \"model\": \"Corolla\",
    \"color\": \"White\",
    \"status\": \"active\",
    \"notes\": \"Test vehicle\"
  }")

echo "$CREATE_VEHICLE"

VEHICLE_ID=$(echo "$CREATE_VEHICLE" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$VEHICLE_ID" ]; then
  echo -e "${RED}❌ Failed to create vehicle${NC}"
  echo -e "${YELLOW}Response: $CREATE_VEHICLE${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Vehicle created with ID: $VEHICLE_ID${NC}\n"

# Step 7: Test GET /api/vehicles/[id] (Get single vehicle)
echo -e "${YELLOW}Step 7: GET /api/vehicles/$VEHICLE_ID (Get single vehicle)...${NC}"
GET_VEHICLE=$(curl -s -X GET "$BASE_URL/api/vehicles/$VEHICLE_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$GET_VEHICLE"
echo ""

# Step 8: Test GET /api/vehicles with filters
echo -e "${YELLOW}Step 8: GET /api/vehicles?tenantId=$TENANT_ID (Filter by tenant)...${NC}"
FILTER_BY_TENANT=$(curl -s -X GET "$BASE_URL/api/vehicles?tenantId=$TENANT_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$FILTER_BY_TENANT"
echo ""

if [ ! -z "$PARKING_SPACE_ID" ]; then
  echo -e "${YELLOW}Step 8b: GET /api/vehicles?parkingSpaceId=$PARKING_SPACE_ID (Filter by parking space)...${NC}"
  FILTER_BY_SPACE=$(curl -s -X GET "$BASE_URL/api/vehicles?parkingSpaceId=$PARKING_SPACE_ID" \
    -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
    -H "Content-Type: application/json")
  echo "$FILTER_BY_SPACE"
  echo ""
fi

echo -e "${YELLOW}Step 8c: GET /api/vehicles?status=active (Filter by status)...${NC}"
FILTER_BY_STATUS=$(curl -s -X GET "$BASE_URL/api/vehicles?status=active" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$FILTER_BY_STATUS"
echo ""

# Step 9: Test PATCH /api/vehicles/[id] (Update vehicle)
echo -e "${YELLOW}Step 9: PATCH /api/vehicles/$VEHICLE_ID (Update vehicle)...${NC}"
UPDATE_VEHICLE=$(curl -s -X PATCH "$BASE_URL/api/vehicles/$VEHICLE_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d '{
    "color": "Black",
    "notes": "Updated vehicle color"
  }')
echo "$UPDATE_VEHICLE"
echo ""

# Step 10: Test GET /api/vehicles/[id] again (Verify update)
echo -e "${YELLOW}Step 10: GET /api/vehicles/$VEHICLE_ID (Verify update)...${NC}"
GET_UPDATED=$(curl -s -X GET "$BASE_URL/api/vehicles/$VEHICLE_ID" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$GET_UPDATED"
echo ""

UPDATED_COLOR=$(echo "$GET_UPDATED" | grep -o '"color":"[^"]*"' | cut -d'"' -f4)
if [ "$UPDATED_COLOR" = "Black" ]; then
  echo -e "${GREEN}✅ Vehicle color updated to Black${NC}"
fi
echo ""

# Step 11: Test assigning vehicle to parking space
if [ ! -z "$PARKING_SPACE_ID" ]; then
  echo -e "${YELLOW}Step 11: PATCH /api/vehicles/$VEHICLE_ID (Assign to parking space)...${NC}"
  ASSIGN_TO_SPACE=$(curl -s -X PATCH "$BASE_URL/api/vehicles/$VEHICLE_ID" \
    -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
    -H "Content-Type: application/json" \
    -d "{
      \"parkingSpaceId\": \"$PARKING_SPACE_ID\"
    }")
  echo "$ASSIGN_TO_SPACE"
  echo ""

  # Verify assignment
  GET_ASSIGNED=$(curl -s -X GET "$BASE_URL/api/vehicles/$VEHICLE_ID" \
    -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
    -H "Content-Type: application/json")
  ASSIGNED_SPACE_ID=$(echo "$GET_ASSIGNED" | grep -o '"parkingSpaceId":"[^"]*"' | cut -d'"' -f4)
  if [ "$ASSIGNED_SPACE_ID" = "$PARKING_SPACE_ID" ]; then
    echo -e "${GREEN}✅ Vehicle assigned to parking space${NC}"
  fi
  echo ""
fi

# Step 12: Create another vehicle
echo -e "${YELLOW}Step 12: POST /api/vehicles (Create another vehicle)...${NC}"
CREATE_VEHICLE2=$(curl -s -X POST "$BASE_URL/api/vehicles" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d "{
    \"tenantId\": \"$TENANT_ID\",
    \"plateNumber\": \"XYZ-5678\",
    \"make\": \"Honda\",
    \"model\": \"Civic\",
    \"color\": \"Blue\",
    \"status\": \"active\"
  }")

VEHICLE_ID2=$(echo "$CREATE_VEHICLE2" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "$CREATE_VEHICLE2"
echo ""

# Step 13: Test PATCH /api/vehicles/[id] (Update vehicle status to inactive)
echo -e "${YELLOW}Step 13: PATCH /api/vehicles/$VEHICLE_ID2 (Update vehicle status to inactive)...${NC}"
UPDATE_TO_INACTIVE=$(curl -s -X PATCH "$BASE_URL/api/vehicles/$VEHICLE_ID2" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "inactive",
    "notes": "Vehicle no longer in use"
  }')
echo "$UPDATE_TO_INACTIVE"
echo ""

# Step 14: Test DELETE /api/vehicles/[id] (Soft delete vehicle)
echo -e "${YELLOW}Step 14: DELETE /api/vehicles/$VEHICLE_ID2 (Soft delete vehicle)...${NC}"
DELETE_VEHICLE=$(curl -s -X DELETE "$BASE_URL/api/vehicles/$VEHICLE_ID2" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$DELETE_VEHICLE"
echo ""

# Step 15: Test GET /api/vehicles/[id] again (Verify soft delete)
echo -e "${YELLOW}Step 15: GET /api/vehicles/$VEHICLE_ID2 (Verify soft delete)...${NC}"
GET_DELETED=$(curl -s -X GET "$BASE_URL/api/vehicles/$VEHICLE_ID2" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$GET_DELETED"
echo ""

DELETED_STATUS=$(echo "$GET_DELETED" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
if [ "$DELETED_STATUS" = "inactive" ]; then
  echo -e "${GREEN}✅ Vehicle soft deleted successfully (status set to inactive)${NC}"
fi
echo ""

# Step 16: Test GET /api/vehicles (List all vehicles)
echo -e "${YELLOW}Step 16: GET /api/vehicles (List all vehicles)...${NC}"
LIST_ALL=$(curl -s -X GET "$BASE_URL/api/vehicles" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")
echo "$LIST_ALL"
echo ""

# Step 17: Test plate number uniqueness (should fail)
echo -e "${YELLOW}Step 17: POST /api/vehicles (Test plate number uniqueness - should fail)...${NC}"
DUPLICATE_PLATE=$(curl -s -X POST "$BASE_URL/api/vehicles" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d "{
    \"tenantId\": \"$TENANT_ID\",
    \"plateNumber\": \"ABC-1234\",
    \"make\": \"Toyota\",
    \"model\": \"Camry\",
    \"status\": \"active\"
  }")
echo "$DUPLICATE_PLATE"
echo ""

if echo "$DUPLICATE_PLATE" | grep -q "already exists"; then
  echo -e "${GREEN}✅ Plate number uniqueness validation working correctly${NC}"
fi
echo ""

echo -e "${GREEN}=== All vehicles API tests completed! ===${NC}"

# Cleanup
rm -f /tmp/bms_vehicles_cookies.txt
rm -f /tmp/bms_vehicles_super_cookies.txt



















