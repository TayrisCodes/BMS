# Notification System Setup Guide

This guide explains how to configure and test the notification system, including email and WhatsApp providers.

## Overview

The BMS notification system supports three delivery channels:

1. **In-app notifications** - Always enabled
2. **Email notifications** - Requires Gmail configuration
3. **WhatsApp notifications** - Requires WhatsApp API configuration

## Environment Variables

Add the following to your `.env` file:

```bash
# Email Configuration (Gmail)
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password  # Gmail App Password, not regular password
EMAIL_FROM_ADDRESS=your-email@gmail.com  # Optional, defaults to EMAIL_USER
EMAIL_FROM_NAME=BMS System  # Optional, defaults to "BMS System"

# WhatsApp Configuration (Placeholder - configure with your WhatsApp API provider)
WHATSAPP_API_KEY=your-whatsapp-api-key
WHATSAPP_API_URL=https://api.whatsapp-provider.com/send  # Your WhatsApp API endpoint

# Cron Secret (for scheduled jobs)
CRON_SECRET=your-secure-random-string
```

## Email Setup (Gmail)

### Step 1: Enable 2-Factor Authentication

1. Go to your Google Account settings
2. Enable 2-Step Verification

### Step 2: Generate App Password

1. Go to [Google App Passwords](https://myaccount.google.com/apppasswords)
2. Select "Mail" and "Other (Custom name)"
3. Enter "BMS System" as the name
4. Click "Generate"
5. Copy the 16-character password (spaces will be removed automatically)

### Step 3: Configure Environment Variables

```bash
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=xxxx xxxx xxxx xxxx  # The app password from step 2
EMAIL_FROM_ADDRESS=your-email@gmail.com
EMAIL_FROM_NAME=BMS System
```

### Step 4: Test Email Sending

Use the test endpoint:

```bash
curl -X POST "http://localhost:3000/api/test/notifications/create" \
  -H "Content-Type: application/json" \
  -H "Cookie: bms_session=YOUR_SESSION_TOKEN" \
  -d '{
    "tenantId": "TENANT_ID",
    "type": "invoice_created",
    "title": "Test Invoice",
    "message": "This is a test notification",
    "channels": ["in_app", "email"]
  }'
```

## WhatsApp Setup

### Supported Providers

The WhatsApp provider supports multiple providers:

1. **Twilio WhatsApp API** (Recommended)
2. **WhatsApp Business API** (Official)
3. **Generic REST API** (Custom providers)

### Twilio WhatsApp Setup (Recommended)

#### Step 1: Create Twilio Account

1. Sign up at [Twilio](https://www.twilio.com/)
2. Verify your account
3. Get a WhatsApp-enabled phone number

#### Step 2: Get Twilio Credentials

1. Go to Twilio Console → Account → API Keys & Tokens
2. Note your:
   - **Account SID**
   - **Auth Token**
   - **WhatsApp-enabled phone number** (format: +14155238886)

#### Step 3: Configure Environment Variables

```bash
# Set provider type
WHATSAPP_PROVIDER=twilio

# Twilio credentials
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_FROM=+14155238886  # Your Twilio WhatsApp number
```

#### Step 4: Test Twilio Integration

```bash
# Test sending a WhatsApp message
curl -X POST "http://localhost:3000/api/test/notifications/create" \
  -H "Content-Type: application/json" \
  -H "Cookie: bms_session=YOUR_SESSION" \
  -d '{
    "tenantId": "TENANT_ID",
    "type": "payment_due",
    "title": "Test WhatsApp",
    "message": "Test message",
    "channels": ["sms"]
  }'
```

### WhatsApp Business API Setup

#### Step 1: Set Up Meta Business Account

1. Create a Meta Business Account
2. Set up WhatsApp Business API
3. Get API credentials

#### Step 2: Configure Environment Variables

```bash
# Set provider type
WHATSAPP_PROVIDER=whatsapp-business

# WhatsApp Business API credentials
WHATSAPP_API_KEY=your_api_key
WHATSAPP_API_URL=https://graph.facebook.com/v18.0/YOUR_PHONE_NUMBER_ID/messages
```

### Generic REST API Setup

For other WhatsApp API providers:

```bash
# Set provider type
WHATSAPP_PROVIDER=generic

# Provider credentials
WHATSAPP_API_KEY=your_api_key
WHATSAPP_API_URL=https://api.provider.com/send
```

### Current Status

The WhatsApp provider supports multiple providers. To implement:

1. **Choose a WhatsApp API Provider:**
   - Twilio WhatsApp API
   - WhatsApp Business API (official)
   - Other third-party providers

2. **Update `src/modules/notifications/providers/whatsapp.ts`:**
   - Replace the mock implementation with actual API calls
   - Update the `sendWhatsApp` method to make HTTP requests to your provider

3. **Example Implementation (Twilio):**

```typescript
async sendWhatsApp(to: string, message: string): Promise<{ success: boolean; error?: string }> {
  if (!this.apiKey || !this.apiUrl) {
    return { success: false, error: "WhatsApp provider not configured." };
  }

  try {
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        to: `whatsapp:${to}`, // Format: whatsapp:+251912345678
        from: `whatsapp:${process.env.WHATSAPP_FROM_NUMBER}`,
        body: message,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`WhatsApp API error: ${response.status} - ${errorData.message || JSON.stringify(errorData)}`);
    }

    return { success: true };
  } catch (error) {
    console.error("Error sending WhatsApp message:", error);
    return { success: false, error: (error as Error).message };
  }
}
```

## Notification Types

The system supports the following notification types:

1. **invoice_created** - Sent when a new invoice is created
2. **payment_due** - Sent as a reminder before payment due date
3. **payment_received** - Sent when a payment is received
4. **complaint_status_changed** - Sent when complaint status changes
5. **work_order_assigned** - Sent when a work order is assigned to a technician
6. **work_order_completed** - Sent when a work order is completed
7. **lease_expiring** - Sent when a lease is about to expire

## Testing Notifications

### 1. Test In-App Notifications

```bash
# Create a test notification
curl -X POST "http://localhost:3000/api/test/notifications/create" \
  -H "Content-Type: application/json" \
  -H "Cookie: bms_session=YOUR_SESSION_TOKEN" \
  -d '{
    "tenantId": "TENANT_ID",
    "type": "invoice_created",
    "title": "Test Notification",
    "message": "This is a test",
    "channels": ["in_app"]
  }'

# List all notifications
curl -X GET "http://localhost:3000/api/notifications" \
  -H "Cookie: bms_session=YOUR_SESSION_TOKEN"
```

### 2. Test Email Notifications

```bash
# Create a notification with email channel
curl -X POST "http://localhost:3000/api/test/notifications/create" \
  -H "Content-Type: application/json" \
  -H "Cookie: bms_session=YOUR_SESSION_TOKEN" \
  -d '{
    "tenantId": "TENANT_ID",
    "type": "invoice_created",
    "title": "Test Email",
    "message": "This should send an email",
    "channels": ["in_app", "email"]
  }'
```

Check the tenant's email inbox (the email address in their tenant record).

### 3. Test WhatsApp Notifications

```bash
# Create a notification with WhatsApp channel
curl -X POST "http://localhost:3000/api/test/notifications/create" \
  -H "Content-Type: application/json" \
  -H "Cookie: bms_session=YOUR_SESSION_TOKEN" \
  -d '{
    "tenantId": "TENANT_ID",
    "type": "payment_due",
    "title": "Test WhatsApp",
    "message": "This should send a WhatsApp message",
    "channels": ["in_app", "sms"]  # 'sms' channel is used for WhatsApp
  }'
```

**Note:** Currently, WhatsApp messages are logged but not actually sent. Implement the API integration as described above.

## Event-Driven Notifications

Notifications are automatically triggered by system events:

### Invoice Created

- Triggered when: Invoice is created via `POST /api/invoices`
- Recipients: Tenant
- Channels: in_app, email, sms

### Payment Received

- Triggered when: Payment is created via `POST /api/payments`
- Recipients: Tenant
- Channels: in_app

### Complaint Status Changed

- Triggered when: Complaint status is updated via `PATCH /api/complaints/[id]`
- Recipients: Tenant
- Channels: in_app, email

### Work Order Assigned

- Triggered when: Work order is created/updated with assignedTo
- Recipients: Technician (user)
- Channels: in_app, sms

### Work Order Completed

- Triggered when: Work order status is set to "completed"
- Recipients: Facility Manager
- Channels: in_app

### Lease Expiring

- Triggered when: Cron job runs and finds expiring leases
- Recipients: Tenant, Building Manager
- Channels: in_app, email, sms

## Troubleshooting

### Email Not Sending

1. **Check Gmail App Password:**
   - Ensure you're using an App Password, not your regular password
   - Verify 2FA is enabled

2. **Check Environment Variables:**

   ```bash
   echo $EMAIL_USER
   echo $EMAIL_PASSWORD
   ```

3. **Check Server Logs:**
   - Look for "Error sending email" messages
   - Check for authentication errors

4. **Test Email Provider Directly:**
   ```bash
   # Check if email provider is configured
   curl -X GET "http://localhost:3000/api/test/notifications/list-all" \
     -H "Cookie: bms_session=YOUR_SESSION_TOKEN" | \
     jq '.notifications[] | select(.deliveryStatus.email)'
   ```

### WhatsApp Not Sending

1. **Check Configuration:**
   - Verify `WHATSAPP_API_KEY` and `WHATSAPP_API_URL` are set
   - Check that the API implementation is complete

2. **Check Logs:**
   - Look for "[WhatsApp]" log messages
   - Verify API responses

### Notifications Not Appearing

1. **Check Database:**

   ```bash
   # List all notifications
   curl -X GET "http://localhost:3000/api/test/notifications/list-all" \
     -H "Cookie: bms_session=YOUR_SESSION_TOKEN"
   ```

2. **Check Query Logic:**
   - Verify user/tenant has access to notifications
   - Check organizationId matches

3. **Check Event Triggers:**
   - Verify events are being triggered
   - Check server logs for notification creation errors

## Production Checklist

- [ ] Configure Gmail App Password
- [ ] Set up WhatsApp API (if using)
- [ ] Configure CRON_SECRET
- [ ] Set up cron jobs (see CRON_SETUP.md)
- [ ] Test all notification types
- [ ] Monitor notification delivery rates
- [ ] Set up error alerts
- [ ] Document tenant contact information requirements
