# Cron Job Setup Guide

This document describes how to set up scheduled cron jobs for the BMS notification system.

## Available Cron Jobs

### 1. Payment Due Reminders

**Endpoint:** `GET /api/cron/payment-due-reminders`

**Purpose:** Sends payment reminders to tenants for invoices due in 3 days and 1 day.

**Schedule:** Daily (recommended: 9:00 AM local time)

**Example:**

```bash
# Using curl with cron secret
curl -X GET "https://your-domain.com/api/cron/payment-due-reminders" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### 2. Lease Expiring Reminders

**Endpoint:** `GET /api/cron/lease-expiring-reminders`

**Purpose:** Sends reminders to tenants about leases expiring in 30 days and 7 days.

**Schedule:** Daily (recommended: 9:00 AM local time)

**Example:**

```bash
# Using curl with cron secret
curl -X GET "https://your-domain.com/api/cron/lease-expiring-reminders" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Setup Options

### Option 1: Vercel Cron (Recommended for Vercel deployments)

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/payment-due-reminders",
      "schedule": "0 9 * * *"
    },
    {
      "path": "/api/cron/lease-expiring-reminders",
      "schedule": "0 9 * * *"
    }
  ]
}
```

**Note:** Vercel Cron automatically adds the `x-vercel-signature` header. Update the route handlers to verify this header instead of `CRON_SECRET` if using Vercel.

### Option 2: External Cron Service (cron-job.org, EasyCron, etc.)

1. Sign up for a cron service
2. Create a new cron job
3. Set the schedule (e.g., daily at 9:00 AM)
4. Set the URL to your endpoint
5. Add custom header: `Authorization: Bearer YOUR_CRON_SECRET`

### Option 3: Server Cron (Linux/Unix)

Add to crontab (`crontab -e`):

```bash
# Payment due reminders - daily at 9:00 AM
0 9 * * * curl -X GET "https://your-domain.com/api/cron/payment-due-reminders" -H "Authorization: Bearer YOUR_CRON_SECRET"

# Lease expiring reminders - daily at 9:00 AM
0 9 * * * curl -X GET "https://your-domain.com/api/cron/lease-expiring-reminders" -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Option 4: GitHub Actions (for testing/development)

Create `.github/workflows/cron-jobs.yml`:

```yaml
name: Cron Jobs

on:
  schedule:
    - cron: '0 9 * * *' # Daily at 9:00 AM UTC
  workflow_dispatch: # Allow manual trigger

jobs:
  payment-reminders:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger payment due reminders
        run: |
          curl -X GET "${{ secrets.API_URL }}/api/cron/payment-due-reminders" \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"

  lease-reminders:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger lease expiring reminders
        run: |
          curl -X GET "${{ secrets.API_URL }}/api/cron/lease-expiring-reminders" \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

## Environment Variables

Add to your `.env` file:

```bash
# Cron secret for protecting cron endpoints
CRON_SECRET=your-secure-random-string-here
```

**Important:** Generate a strong random secret:

```bash
# Generate a secure random secret
openssl rand -base64 32
```

## Security Considerations

1. **Always use HTTPS** for cron endpoints in production
2. **Use a strong CRON_SECRET** and never commit it to version control
3. **Consider IP whitelisting** if your cron service provides static IPs
4. **Monitor cron job execution** to ensure they're running as expected
5. **Set up alerts** for failed cron jobs

## Testing Cron Jobs

### Manual Testing

```bash
# Test payment due reminders
curl -X GET "http://localhost:3000/api/cron/payment-due-reminders" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Test lease expiring reminders
curl -X GET "http://localhost:3000/api/cron/lease-expiring-reminders" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Without CRON_SECRET (Development)

If `CRON_SECRET` is not set, the endpoints will still work (for development convenience), but this should never be the case in production.

## Monitoring

Consider adding logging and monitoring:

1. Log cron job execution times
2. Track number of notifications sent
3. Set up alerts for failures
4. Monitor notification delivery rates

## Troubleshooting

### Cron job not running

- Check cron service logs
- Verify CRON_SECRET is correct
- Ensure endpoint is accessible
- Check server logs for errors

### Notifications not being sent

- Verify email/WhatsApp credentials are configured
- Check notification service logs
- Verify tenant/user contact information is correct
- Check database for notification records
