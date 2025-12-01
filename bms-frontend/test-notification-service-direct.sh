#!/bin/bash

# Direct test of notification service
# This script tests the notification service directly by creating notifications manually

BASE_URL="http://localhost:3000"
SESSION_COOKIE="bms_session"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Direct Notification Service Test ===${NC}\n"

# Check if server is running
if ! curl -s "$BASE_URL/api/health" > /dev/null 2>&1; then
  echo -e "${RED}❌ Server is not running at $BASE_URL${NC}"
  exit 1
fi

# Step 1: Login as ORG_ADMIN
echo -e "${YELLOW}Step 1: Logging in as ORG_ADMIN...${NC}"
ORG_ADMIN_LOGIN=$(curl -s -c /tmp/bms_notif_direct_cookies.txt -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"identifier": "admin@example.com", "password": "ChangeMe123!"}')

ORG_ADMIN_SESSION=$(grep "$SESSION_COOKIE" /tmp/bms_notif_direct_cookies.txt | awk '{print $7}')

if [ -z "$ORG_ADMIN_SESSION" ]; then
  echo -e "${RED}❌ Failed to get session token${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Logged in${NC}\n"

# Step 2: Get tenant ID
echo -e "${YELLOW}Step 2: Getting tenant ID...${NC}"
LIST_TENANTS=$(curl -s -X GET "$BASE_URL/api/tenants?status=active" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")

TENANT_ID=$(echo "$LIST_TENANTS" | python3 -c "import sys, json; data=json.load(sys.stdin); tenants=data.get('tenants', []); print(tenants[0]['_id'] if tenants else '')" 2>/dev/null || echo "$LIST_TENANTS" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
ORG_ID=$(echo "$LIST_TENANTS" | python3 -c "import sys, json; data=json.load(sys.stdin); tenants=data.get('tenants', []); print(tenants[0]['organizationId'] if tenants else '')" 2>/dev/null || echo "$LIST_TENANTS" | grep -o '"organizationId":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$TENANT_ID" ] || [ -z "$ORG_ID" ]; then
  echo -e "${RED}❌ Failed to get tenant or organization ID${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Tenant ID: $TENANT_ID, Org ID: $ORG_ID${NC}\n"

# Step 3: Create a test notification directly via API (if we had an endpoint)
# Since we don't have a direct notification creation endpoint, let's test by creating a payment
echo -e "${YELLOW}Step 3: Creating a payment to trigger notification...${NC}"

PAYMENT_DATE=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")
REF_NUM="DIRECT-TEST-$(date +%s)"

CREATE_PAYMENT=$(curl -s -X POST "$BASE_URL/api/payments" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  -d "{
    \"tenantId\": \"$TENANT_ID\",
    \"amount\": 5000,
    \"paymentMethod\": \"cash\",
    \"paymentDate\": \"$PAYMENT_DATE\",
    \"status\": \"completed\",
    \"referenceNumber\": \"$REF_NUM\"
  }")

PAYMENT_ID=$(echo "$CREATE_PAYMENT" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$PAYMENT_ID" ]; then
  echo -e "${RED}❌ Failed to create payment${NC}"
  echo "$CREATE_PAYMENT"
  exit 1
fi

echo -e "${GREEN}✅ Payment created: $PAYMENT_ID${NC}\n"

# Step 4: Wait a moment for notification to be processed
echo -e "${YELLOW}Step 4: Waiting for notification processing...${NC}"
sleep 3

# Step 5: Check notifications
echo -e "${YELLOW}Step 5: Checking notifications...${NC}"
NOTIFICATIONS=$(curl -s -X GET "$BASE_URL/api/notifications" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")

echo "$NOTIFICATIONS" | python3 -m json.tool 2>/dev/null || echo "$NOTIFICATIONS"
echo ""

# Step 6: Check if notification was created
NOTIF_COUNT=$(echo "$NOTIFICATIONS" | grep -o '"notifications":\[' | wc -l)
NOTIF_ARRAY=$(echo "$NOTIFICATIONS" | python3 -c "import sys, json; data=json.load(sys.stdin); print(len(data.get('notifications', [])))" 2>/dev/null || echo "0")

if [ "$NOTIF_ARRAY" != "0" ]; then
  echo -e "${GREEN}✅ Found $NOTIF_ARRAY notification(s)${NC}"
  
  # Show notification details
  echo -e "${YELLOW}Notification details:${NC}"
  echo "$NOTIFICATIONS" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for n in data.get('notifications', []):
    print(f\"  Type: {n.get('type')}\")
    print(f\"  Title: {n.get('title')}\")
    print(f\"  Read: {n.get('read')}\")
    print(f\"  Created: {n.get('createdAt')}\")
    print()
" 2>/dev/null || echo "  (Could not parse notification details)"
else
  echo -e "${YELLOW}⚠️  No notifications found${NC}"
  echo -e "${YELLOW}This could mean:${NC}"
  echo -e "  1. Notification creation is failing silently"
  echo -e "  2. Notification query is not finding the notifications"
  echo -e "  3. Event trigger is not being called"
  echo ""
  echo -e "${YELLOW}Checking server console for errors...${NC}"
  echo -e "${YELLOW}(Please check your dev server terminal for any error messages)${NC}"
fi

echo ""

# Step 7: Test notification creation with different query approaches
echo -e "${YELLOW}Step 7: Testing notification query with different parameters...${NC}"

# Try querying by organization only
echo -e "${YELLOW}7a: Query by organizationId only...${NC}"
# We can't easily test this without modifying the API, but we can check the current query

# Step 8: Summary
echo -e "${YELLOW}=== Test Summary ===${NC}"
echo -e "✅ Authentication"
echo -e "✅ Payment creation"
if [ "$NOTIF_ARRAY" != "0" ]; then
  echo -e "✅ Notification creation and retrieval"
else
  echo -e "❌ Notification creation/retrieval - needs investigation"
fi
echo ""

echo -e "${GREEN}=== Direct notification test completed! ===${NC}"

# Cleanup
rm -f /tmp/bms_notif_direct_cookies.txt

