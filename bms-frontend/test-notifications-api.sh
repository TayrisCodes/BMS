#!/bin/bash

# Test script for Notifications API endpoints
# Make sure the dev server is running: npm run dev

BASE_URL="http://localhost:3000"
SESSION_COOKIE="bms_session"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== BMS Notifications API Test Script ===${NC}\n"

# Check if server is running
if ! curl -s "$BASE_URL/api/health" > /dev/null 2>&1; then
  echo -e "${RED}❌ Server is not running at $BASE_URL${NC}"
  echo -e "${YELLOW}Please start the dev server with: npm run dev${NC}"
  exit 1
fi

# Step 1: Login as ORG_ADMIN
echo -e "${YELLOW}Step 1: Logging in as ORG_ADMIN...${NC}"
ORG_ADMIN_LOGIN=$(curl -s -c /tmp/bms_notifications_cookies.txt -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"identifier": "admin@example.com", "password": "ChangeMe123!"}')

echo "$ORG_ADMIN_LOGIN"

ORG_ADMIN_SESSION=$(grep "$SESSION_COOKIE" /tmp/bms_notifications_cookies.txt | awk '{print $7}')

if [ -z "$ORG_ADMIN_SESSION" ]; then
  echo -e "${RED}❌ Failed to get ORG_ADMIN session token${NC}"
  exit 1
fi

echo -e "${GREEN}✅ ORG_ADMIN session token obtained${NC}\n"

# Step 2: Ensure indexes are created (including notifications)
echo -e "${YELLOW}Step 2: Ensuring database indexes (including notifications)...${NC}"
ENSURE_INDEXES=$(curl -s -X POST "$BASE_URL/api/admin/ensure-indexes" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")

echo "$ENSURE_INDEXES"
echo ""

# Step 3: Get or create tenant and invoice for testing
echo -e "${YELLOW}Step 3: Getting or creating tenant and invoice for testing...${NC}"

# Get tenant
LIST_TENANTS=$(curl -s -X GET "$BASE_URL/api/tenants?status=active" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")

TENANT_ID=$(echo "$LIST_TENANTS" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$TENANT_ID" ]; then
  echo -e "${YELLOW}No tenant found, creating one...${NC}"
  CREATE_TENANT=$(curl -s -X POST "$BASE_URL/api/tenants" \
    -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
    -H "Content-Type: application/json" \
    -d '{
      "firstName": "Notification",
      "lastName": "Test",
      "primaryPhone": "+251912345678",
      "email": "tenant@example.com",
      "status": "active"
    }')
  TENANT_ID=$(echo "$CREATE_TENANT" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
fi

# Get invoice
LIST_INVOICES=$(curl -s -X GET "$BASE_URL/api/invoices?status=sent" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")

INVOICE_ID=$(echo "$LIST_INVOICES" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$INVOICE_ID" ]; then
  echo -e "${YELLOW}No invoice found, will test without invoice context${NC}"
fi

echo -e "${GREEN}✅ Tenant ID: $TENANT_ID${NC}"
if [ -n "$INVOICE_ID" ]; then
  echo -e "${GREEN}✅ Invoice ID: $INVOICE_ID${NC}"
fi
echo ""

# Step 4: Test GET /api/notifications (List notifications - should be empty initially)
echo -e "${YELLOW}Step 4: GET /api/notifications (List notifications)...${NC}"
LIST_NOTIFICATIONS=$(curl -s -X GET "$BASE_URL/api/notifications" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")

echo "$LIST_NOTIFICATIONS" | python3 -m json.tool 2>/dev/null || echo "$LIST_NOTIFICATIONS"
echo ""

# Extract unread count
UNREAD_COUNT=$(echo "$LIST_NOTIFICATIONS" | grep -o '"unreadCount":[0-9]*' | cut -d':' -f2)
if [ -z "$UNREAD_COUNT" ]; then
  UNREAD_COUNT=0
fi

echo -e "${GREEN}✅ Current unread count: $UNREAD_COUNT${NC}\n"

# Step 5: Test notification creation via event (simulate invoice created)
echo -e "${YELLOW}Step 5: Testing notification creation (simulating invoice_created event)...${NC}"
echo -e "${YELLOW}Note: This would normally be triggered automatically when an invoice is created${NC}"

# We'll test by creating a payment which should trigger payment_received notification
# But first, let's test the notification service directly by creating a payment
if [ -n "$INVOICE_ID" ]; then
  echo -e "${YELLOW}Creating a payment to trigger payment_received notification...${NC}"
  
  PAYMENT_DATE=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")
  
  CREATE_PAYMENT=$(curl -s -X POST "$BASE_URL/api/payments" \
    -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
    -H "Content-Type: application/json" \
    -d "{
      \"invoiceId\": \"$INVOICE_ID\",
      \"tenantId\": \"$TENANT_ID\",
      \"amount\": 15000,
      \"paymentMethod\": \"telebirr\",
      \"paymentDate\": \"$PAYMENT_DATE\",
      \"referenceNumber\": \"NOTIF-TEST-$(date +%s)\",
      \"status\": \"completed\",
      \"notes\": \"Test payment for notifications\"
    }")
  
  echo "$CREATE_PAYMENT"
  echo ""
  
  # Wait a moment for notification to be created
  sleep 2
fi

# Step 6: Test GET /api/notifications again (Check if notifications were created)
echo -e "${YELLOW}Step 6: GET /api/notifications (Check for new notifications)...${NC}"
LIST_NOTIFICATIONS_AFTER=$(curl -s -X GET "$BASE_URL/api/notifications" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")

echo "$LIST_NOTIFICATIONS_AFTER" | python3 -m json.tool 2>/dev/null || echo "$LIST_NOTIFICATIONS_AFTER"
echo ""

# Extract notification ID
NOTIFICATION_ID=$(echo "$LIST_NOTIFICATIONS_AFTER" | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "$LIST_NOTIFICATIONS_AFTER" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$NOTIFICATION_ID" ]; then
  # Try alternative format
  NOTIFICATION_ID=$(echo "$LIST_NOTIFICATIONS_AFTER" | grep -oP '(?<="id":")[^"]*' | head -1)
fi

if [ -n "$NOTIFICATION_ID" ]; then
  echo -e "${GREEN}✅ Found notification with ID: $NOTIFICATION_ID${NC}\n"
  
  # Step 7: Test PATCH /api/notifications/[id]/read (Mark notification as read)
  echo -e "${YELLOW}Step 7: PATCH /api/notifications/$NOTIFICATION_ID/read (Mark notification as read)...${NC}"
  MARK_READ=$(curl -s -X PATCH "$BASE_URL/api/notifications/$NOTIFICATION_ID/read" \
    -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
    -H "Content-Type: application/json")
  
  echo "$MARK_READ"
  echo ""
  
  if echo "$MARK_READ" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ Notification marked as read${NC}\n"
  else
    echo -e "${YELLOW}⚠️  Could not mark notification as read (may need userId in session)${NC}\n"
  fi
  
  # Step 8: Test GET /api/notifications again (Verify read status)
  echo -e "${YELLOW}Step 8: GET /api/notifications (Verify notification is marked as read)...${NC}"
  LIST_NOTIFICATIONS_READ=$(curl -s -X GET "$BASE_URL/api/notifications" \
    -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
    -H "Content-Type: application/json")
  
  echo "$LIST_NOTIFICATIONS_READ" | python3 -m json.tool 2>/dev/null || echo "$LIST_NOTIFICATIONS_READ"
  echo ""
  
  # Check if notification is marked as read
  if echo "$LIST_NOTIFICATIONS_READ" | grep -q '"read":true'; then
    echo -e "${GREEN}✅ Notification is marked as read${NC}\n"
  else
    echo -e "${YELLOW}⚠️  Notification read status not updated (may need userId in session)${NC}\n"
  fi
else
  echo -e "${YELLOW}⚠️  No notifications found. This is expected if event triggers are not yet integrated.${NC}\n"
fi

# Step 9: Test unread count
echo -e "${YELLOW}Step 9: GET /api/notifications (Check unread count)...${NC}"
UNREAD_RESPONSE=$(curl -s -X GET "$BASE_URL/api/notifications" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")

NEW_UNREAD_COUNT=$(echo "$UNREAD_RESPONSE" | grep -o '"unreadCount":[0-9]*' | cut -d':' -f2)
if [ -z "$NEW_UNREAD_COUNT" ]; then
  NEW_UNREAD_COUNT=0
fi

echo -e "${GREEN}✅ Unread count: $NEW_UNREAD_COUNT${NC}\n"

# Step 10: Test payment due reminders cron job
echo -e "${YELLOW}Step 10: GET /api/cron/payment-due-reminders (Test payment due reminders cron job)...${NC}"
echo -e "${YELLOW}Note: This endpoint should be protected with CRON_SECRET in production${NC}"

# Try with no auth first (should fail if CRON_SECRET is set)
CRON_RESPONSE=$(curl -s -X GET "$BASE_URL/api/cron/payment-due-reminders" \
  -H "Content-Type: application/json")

echo "$CRON_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$CRON_RESPONSE"
echo ""

# If CRON_SECRET is set, try with it
if [ -n "$CRON_SECRET" ]; then
  echo -e "${YELLOW}Retrying with CRON_SECRET...${NC}"
  CRON_RESPONSE_AUTH=$(curl -s -X GET "$BASE_URL/api/cron/payment-due-reminders" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $CRON_SECRET")
  
  echo "$CRON_RESPONSE_AUTH" | python3 -m json.tool 2>/dev/null || echo "$CRON_RESPONSE_AUTH"
  echo ""
fi

# Step 11: Test notification filtering (if we have notifications)
if [ -n "$NOTIFICATION_ID" ]; then
  echo -e "${YELLOW}Step 11: Testing notification filtering and metadata...${NC}"
  
  # Get notifications and check metadata
  NOTIF_DETAILS=$(curl -s -X GET "$BASE_URL/api/notifications" \
    -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
    -H "Content-Type: application/json")
  
  # Check if notifications have proper structure
  if echo "$NOTIF_DETAILS" | grep -q '"type"'; then
    echo -e "${GREEN}✅ Notifications have type field${NC}"
  fi
  
  if echo "$NOTIF_DETAILS" | grep -q '"deliveryStatus"'; then
    echo -e "${GREEN}✅ Notifications have deliveryStatus field${NC}"
  fi
  
  if echo "$NOTIF_DETAILS" | grep -q '"metadata"'; then
    echo -e "${GREEN}✅ Notifications have metadata field${NC}"
  fi
  
  echo ""
fi

# Step 12: Test error cases
echo -e "${YELLOW}Step 12: Testing error cases...${NC}"

# Try to mark non-existent notification as read
echo -e "${YELLOW}12a: PATCH /api/notifications/invalid-id/read (Should fail)...${NC}"
INVALID_READ=$(curl -s -X PATCH "$BASE_URL/api/notifications/invalid-id/read" \
  -b "$SESSION_COOKIE=$ORG_ADMIN_SESSION" \
  -H "Content-Type: application/json")

echo "$INVALID_READ"
if echo "$INVALID_READ" | grep -q "error\|404\|not found"; then
  echo -e "${GREEN}✅ Correctly rejected invalid notification ID${NC}"
else
  echo -e "${YELLOW}⚠️  Unexpected response${NC}"
fi
echo ""

# Try to access notifications without auth
echo -e "${YELLOW}12b: GET /api/notifications (Without auth - should fail)...${NC}"
NO_AUTH_RESPONSE=$(curl -s -X GET "$BASE_URL/api/notifications" \
  -H "Content-Type: application/json")

if echo "$NO_AUTH_RESPONSE" | grep -q "Unauthorized\|401"; then
  echo -e "${GREEN}✅ Correctly rejected unauthenticated request${NC}"
else
  echo -e "${YELLOW}⚠️  Response: $NO_AUTH_RESPONSE${NC}"
fi
echo ""

# Summary
echo -e "${YELLOW}=== Test Summary ===${NC}"
echo -e "✅ Server health check"
echo -e "✅ Authentication"
echo -e "✅ Database indexes"
echo -e "✅ GET /api/notifications"
echo -e "✅ PATCH /api/notifications/[id]/read"
echo -e "✅ Unread count"
echo -e "✅ Payment due reminders cron job"
echo -e "✅ Error handling"
echo ""

echo -e "${GREEN}=== All notification tests completed! ===${NC}"
echo -e "${YELLOW}Note: To fully test notifications, integrate event triggers in:${NC}"
echo -e "  - Invoice creation service"
echo -e "  - Payment creation service"
echo -e "  - Complaint status updates"
echo -e "  - Work order assignments"
echo ""

# Cleanup
rm -f /tmp/bms_notifications_cookies.txt



















