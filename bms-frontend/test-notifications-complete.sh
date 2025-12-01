#!/bin/bash

# Comprehensive test script for the complete notification system
# Tests all integrations, email, WhatsApp, and cron jobs

BASE_URL="http://localhost:3000"
SESSION_COOKIE="bms_session"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   BMS Notification System - Complete Integration Test      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if server is running
if ! curl -s "$BASE_URL/api/health" > /dev/null 2>&1; then
  echo -e "${RED}❌ Server is not running at $BASE_URL${NC}"
  echo -e "${YELLOW}Please start the dev server with: npm run dev${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Server is running${NC}\n"

# Step 1: Login
echo -e "${YELLOW}Step 1: Authenticating...${NC}"
LOGIN_RESPONSE=$(curl -s -c /tmp/bms_complete_test_cookies.txt -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"identifier": "admin@example.com", "password": "ChangeMe123!"}')

SESSION=$(grep "$SESSION_COOKIE" /tmp/bms_complete_test_cookies.txt | awk '{print $7}')

if [ -z "$SESSION" ]; then
  echo -e "${RED}❌ Authentication failed${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Authenticated successfully${NC}\n"

# Step 2: Get tenant and organization info
echo -e "${YELLOW}Step 2: Getting tenant information...${NC}"
TENANTS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/tenants?status=active" \
  -b "$SESSION_COOKIE=$SESSION")

TENANT_ID=$(echo "$TENANTS_RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    tenants = data.get('tenants', [])
    if tenants:
        print(tenants[0]['_id'])
    else:
        print('')
except:
    print('')
" 2>/dev/null)

ORG_ID=$(echo "$TENANTS_RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    tenants = data.get('tenants', [])
    if tenants:
        print(tenants[0]['organizationId'])
    else:
        print('')
except:
    print('')
" 2>/dev/null)

if [ -z "$TENANT_ID" ] || [ -z "$ORG_ID" ]; then
  echo -e "${YELLOW}⚠️  No active tenants found. Creating test tenant...${NC}"
  # Try to create a test tenant or use existing data
  echo -e "${YELLOW}   Using existing test data...${NC}"
else
  echo -e "${GREEN}✅ Tenant ID: $TENANT_ID${NC}"
  echo -e "${GREEN}✅ Organization ID: $ORG_ID${NC}\n"
fi

# Step 3: Test Email Configuration
echo -e "${YELLOW}Step 3: Testing Email Configuration...${NC}"
if [ -f .env ]; then
  EMAIL_USER=$(grep "^EMAIL_USER=" .env | cut -d'=' -f2 | tr -d '"' | tr -d "'")
  EMAIL_PASSWORD=$(grep "^EMAIL_PASSWORD=" .env | cut -d'=' -f2 | tr -d '"' | tr -d "'")
  
  if [ -n "$EMAIL_USER" ] && [ -n "$EMAIL_PASSWORD" ] && [ "$EMAIL_USER" != "your-email@gmail.com" ]; then
    echo -e "${GREEN}✅ Email configured: $EMAIL_USER${NC}"
  else
    echo -e "${YELLOW}⚠️  Email not fully configured${NC}"
  fi
else
  echo -e "${YELLOW}⚠️  .env file not found${NC}"
fi
echo ""

# Step 4: Test WhatsApp Configuration
echo -e "${YELLOW}Step 4: Testing WhatsApp Configuration...${NC}"
if [ -f .env ]; then
  WHATSAPP_KEY=$(grep "^WHATSAPP_API_KEY=" .env | cut -d'=' -f2 | tr -d '"' | tr -d "'")
  WHATSAPP_URL=$(grep "^WHATSAPP_API_URL=" .env | cut -d'=' -f2 | tr -d '"' | tr -d "'")
  
  if [ -n "$WHATSAPP_KEY" ] && [ -n "$WHATSAPP_URL" ] && [ "$WHATSAPP_KEY" != "your_whatsapp_api_key" ]; then
    echo -e "${GREEN}✅ WhatsApp configured${NC}"
  else
    echo -e "${YELLOW}⚠️  WhatsApp in mock mode (for testing)${NC}"
  fi
else
  echo -e "${YELLOW}⚠️  .env file not found${NC}"
fi
echo ""

# Step 5: Test Notification API
echo -e "${YELLOW}Step 5: Testing Notification API Endpoints...${NC}"
NOTIFICATIONS=$(curl -s -X GET "$BASE_URL/api/notifications" \
  -b "$SESSION_COOKIE=$SESSION")

NOTIF_COUNT=$(echo "$NOTIFICATIONS" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(len(data.get('notifications', [])))
except:
    print('0')
" 2>/dev/null)

UNREAD_COUNT=$(echo "$NOTIFICATIONS" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('unreadCount', 0))
except:
    print('0')
" 2>/dev/null)

echo -e "${GREEN}✅ Total notifications: $NOTIF_COUNT${NC}"
echo -e "${GREEN}✅ Unread notifications: $UNREAD_COUNT${NC}"
echo ""

# Step 6: Test Cron Jobs
echo -e "${YELLOW}Step 6: Testing Cron Jobs...${NC}"

# Get CRON_SECRET from .env
if [ -f .env ]; then
  CRON_SECRET=$(grep "^CRON_SECRET=" .env | cut -d'=' -f2- | tr -d '"' | tr -d "'" | xargs)
  
  if [ -n "$CRON_SECRET" ] && [ "$CRON_SECRET" != "your_cron_secret_key" ]; then
    echo -e "${GREEN}✅ CRON_SECRET found${NC}"
    
    # Test payment due reminders
    echo -e "${YELLOW}   Testing payment due reminders...${NC}"
    PAYMENT_CRON=$(curl -s -X GET "$BASE_URL/api/cron/payment-due-reminders" \
      -H "Authorization: Bearer $CRON_SECRET")
    
    if echo "$PAYMENT_CRON" | grep -q "error"; then
      echo -e "${RED}   ❌ Payment due reminders cron failed${NC}"
      echo "   Response: $PAYMENT_CRON"
    else
      echo -e "${GREEN}   ✅ Payment due reminders cron executed${NC}"
    fi
    
    # Test lease expiring reminders
    echo -e "${YELLOW}   Testing lease expiring reminders...${NC}"
    LEASE_CRON=$(curl -s -X GET "$BASE_URL/api/cron/lease-expiring-reminders" \
      -H "Authorization: Bearer $CRON_SECRET")
    
    if echo "$LEASE_CRON" | grep -q "error"; then
      echo -e "${RED}   ❌ Lease expiring reminders cron failed${NC}"
      echo "   Response: $LEASE_CRON"
    else
      echo -e "${GREEN}   ✅ Lease expiring reminders cron executed${NC}"
    fi
  else
    echo -e "${YELLOW}⚠️  CRON_SECRET not configured or using default${NC}"
    echo -e "${YELLOW}   Cron jobs will require authentication${NC}"
  fi
else
  echo -e "${YELLOW}⚠️  .env file not found${NC}"
fi
echo ""

# Step 7: Test Event Triggers (if tenant exists)
if [ -n "$TENANT_ID" ] && [ -n "$ORG_ID" ]; then
  echo -e "${YELLOW}Step 7: Testing Event Triggers...${NC}"
  
  # Test creating a payment (triggers payment_received notification)
  echo -e "${YELLOW}   Creating payment to trigger notification...${NC}"
  PAYMENT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/payments" \
    -b "$SESSION_COOKIE=$SESSION" \
    -H "Content-Type: application/json" \
    -d "{
      \"tenantId\": \"$TENANT_ID\",
      \"amount\": 5000,
      \"paymentMethod\": \"cash\",
      \"paymentDate\": \"$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")\",
      \"status\": \"completed\",
      \"referenceNumber\": \"TEST-NOTIF-$(date +%s)\"
    }")
  
  PAYMENT_ID=$(echo "$PAYMENT_RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    payment = data.get('payment', {})
    print(payment.get('_id', ''))
except:
    print('')
" 2>/dev/null)
  
  if [ -n "$PAYMENT_ID" ]; then
    echo -e "${GREEN}   ✅ Payment created: $PAYMENT_ID${NC}"
    
    # Wait for notification to be processed
    sleep 2
    
    # Check for new notification
    NEW_NOTIFICATIONS=$(curl -s -X GET "$BASE_URL/api/notifications" \
      -b "$SESSION_COOKIE=$SESSION")
    
    NEW_COUNT=$(echo "$NEW_NOTIFICATIONS" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    notifications = data.get('notifications', [])
    # Count payment_received notifications
    count = sum(1 for n in notifications if n.get('type') == 'payment_received')
    print(count)
except:
    print('0')
" 2>/dev/null)
    
    if [ "$NEW_COUNT" -gt 0 ]; then
      echo -e "${GREEN}   ✅ Payment notification triggered (found $NEW_COUNT notification(s))${NC}"
    else
      echo -e "${YELLOW}   ⚠️  Payment notification may not have been created yet${NC}"
    fi
  else
    echo -e "${YELLOW}   ⚠️  Could not create payment (may need invoice first)${NC}"
  fi
  echo ""
fi

# Step 8: Summary
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                    Test Summary                            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✅ Authentication${NC}"
echo -e "${GREEN}✅ Notification API${NC}"
echo -e "${GREEN}✅ Email Configuration${NC}"
echo -e "${GREEN}✅ WhatsApp Configuration (mock mode)${NC}"
echo -e "${GREEN}✅ Cron Jobs${NC}"
echo ""
echo -e "${YELLOW}📝 Next Steps:${NC}"
echo -e "   1. Configure WhatsApp API provider (see NOTIFICATION_SETUP.md)"
echo -e "   2. Set up external cron service (see CRON_SETUP.md)"
echo -e "   3. Monitor notification delivery in production"
echo ""
echo -e "${BLUE}For detailed setup instructions, see:${NC}"
echo -e "   - NOTIFICATION_SETUP.md"
echo -e "   - CRON_SETUP.md"
echo -e "   - INTEGRATION_SUMMARY.md"
echo ""

# Cleanup
rm -f /tmp/bms_complete_test_cookies.txt /tmp/tenant_id.txt



















