#!/bin/bash

# Test script for email and WhatsApp providers
BASE_URL="http://localhost:3000"
SESSION_COOKIE="bms_session"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}=== Email and WhatsApp Provider Test ===${NC}\n"

# Login
echo -e "${YELLOW}Step 1: Logging in...${NC}"
LOGIN=$(curl -s -c /tmp/bms_test_cookies.txt -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"identifier": "admin@example.com", "password": "ChangeMe123!"}')

SESSION=$(grep "$SESSION_COOKIE" /tmp/bms_test_cookies.txt | awk '{print $7}')

if [ -z "$SESSION" ]; then
  echo -e "${RED}❌ Failed to login${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Logged in${NC}\n"

# Get tenant ID
echo -e "${YELLOW}Step 2: Getting tenant ID...${NC}"
TENANTS=$(curl -s -X GET "$BASE_URL/api/tenants?status=active" \
  -b "$SESSION_COOKIE=$SESSION")

TENANT_ID=$(echo "$TENANTS" | python3 -c "import sys, json; data=json.load(sys.stdin); tenants=data.get('tenants', []); print(tenants[0]['_id'] if tenants else '')" 2>/dev/null)
ORG_ID=$(echo "$TENANTS" | python3 -c "import sys, json; data=json.load(sys.stdin); tenants=data.get('tenants', []); print(tenants[0]['organizationId'] if tenants else '')" 2>/dev/null)

if [ -z "$TENANT_ID" ] || [ -z "$ORG_ID" ]; then
  echo -e "${RED}❌ Failed to get tenant or organization ID${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Tenant ID: $TENANT_ID, Org ID: $ORG_ID${NC}\n"

# Test Email Configuration
echo -e "${YELLOW}Step 3: Testing email configuration...${NC}"
if [ -z "$EMAIL_USER" ] || [ -z "$EMAIL_PASSWORD" ]; then
  echo -e "${YELLOW}⚠️  EMAIL_USER or EMAIL_PASSWORD not set in environment${NC}"
  echo -e "${YELLOW}   Email notifications will be disabled${NC}"
else
  echo -e "${GREEN}✅ Email credentials found${NC}"
  
  # Create test notification with email
  echo -e "${YELLOW}Creating test email notification...${NC}"
  CREATE_NOTIF=$(curl -s -X POST "$BASE_URL/api/test/notifications/create" \
    -b "$SESSION_COOKIE=$SESSION" \
    -H "Content-Type: application/json" \
    -d "{
      \"organizationId\": \"$ORG_ID\",
      \"tenantId\": \"$TENANT_ID\",
      \"type\": \"invoice_created\",
      \"title\": \"Test Email Notification\",
      \"message\": \"This is a test email notification\",
      \"channels\": [\"in_app\", \"email\"],
      \"metadata\": {
        \"invoiceNumber\": \"TEST-001\",
        \"amount\": 1000,
        \"dueDate\": \"$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")\"
      }
    }")
  
  echo "$CREATE_NOTIF" | python3 -m json.tool 2>/dev/null || echo "$CREATE_NOTIF"
  echo ""
  
  sleep 2
  
  # Check delivery status
  NOTIFS=$(curl -s -X GET "$BASE_URL/api/test/notifications/list-all" \
    -b "$SESSION_COOKIE=$SESSION")
  
  EMAIL_STATUS=$(echo "$NOTIFS" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for n in data.get('notifications', []):
    if n.get('type') == 'invoice_created' and 'Test Email' in n.get('title', ''):
        email = n.get('deliveryStatus', {}).get('email', {})
        print(f\"Email sent: {email.get('sent', False)}\")
        print(f\"Email delivered: {email.get('delivered', False)}\")
        if email.get('error'):
            print(f\"Email error: {email.get('error')}\")
        break
" 2>/dev/null)
  
  echo -e "${YELLOW}Email delivery status:${NC}"
  echo "$EMAIL_STATUS"
fi

echo ""

# Test WhatsApp Configuration
echo -e "${YELLOW}Step 4: Testing WhatsApp configuration...${NC}"
if [ -z "$WHATSAPP_API_KEY" ] || [ -z "$WHATSAPP_API_URL" ]; then
  echo -e "${YELLOW}⚠️  WHATSAPP_API_KEY or WHATSAPP_API_URL not set${NC}"
  echo -e "${YELLOW}   WhatsApp notifications will be disabled (mock mode)${NC}"
else
  echo -e "${GREEN}✅ WhatsApp credentials found${NC}"
fi

# Create test notification with WhatsApp
echo -e "${YELLOW}Creating test WhatsApp notification...${NC}"
CREATE_NOTIF=$(curl -s -X POST "$BASE_URL/api/test/notifications/create" \
  -b "$SESSION_COOKIE=$SESSION" \
  -H "Content-Type: application/json" \
  -d "{
    \"organizationId\": \"$ORG_ID\",
    \"tenantId\": \"$TENANT_ID\",
    \"type\": \"payment_due\",
    \"title\": \"Test WhatsApp Notification\",
    \"message\": \"This is a test WhatsApp notification\",
    \"channels\": [\"in_app\", \"sms\"],
    \"metadata\": {
      \"invoiceNumber\": \"TEST-002\",
      \"amount\": 2000,
      \"dueDate\": \"$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")\",
      \"daysUntilDue\": 3
    }
  }")

echo "$CREATE_NOTIF" | python3 -m json.tool 2>/dev/null || echo "$CREATE_NOTIF"
echo ""

sleep 2

# Check delivery status
NOTIFS=$(curl -s -X GET "$BASE_URL/api/test/notifications/list-all" \
  -b "$SESSION_COOKIE=$SESSION")

SMS_STATUS=$(echo "$NOTIFS" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for n in data.get('notifications', []):
    if n.get('type') == 'payment_due' and 'Test WhatsApp' in n.get('title', ''):
        sms = n.get('deliveryStatus', {}).get('sms', {})
        print(f\"WhatsApp sent: {sms.get('sent', False)}\")
        print(f\"WhatsApp delivered: {sms.get('delivered', False)}\")
        if sms.get('error'):
            print(f\"WhatsApp error: {sms.get('error')}\")
        break
" 2>/dev/null)

echo -e "${YELLOW}WhatsApp delivery status:${NC}"
echo "$SMS_STATUS"

echo ""
echo -e "${GREEN}=== Test completed! ===${NC}"
echo -e "${YELLOW}Note: Check server logs for detailed delivery information${NC}"

# Cleanup
rm -f /tmp/bms_test_cookies.txt
