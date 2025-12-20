# Automated Monthly Invoice Generation Setup

## Overview

The system now supports automated monthly invoice generation for all active leases. This can be triggered manually via the UI or automatically via cron jobs.

## Manual Trigger

1. Navigate to `/org/invoices`
2. Click the "Generate Monthly" button
3. The system will:
   - Generate invoices for all active leases in the current month
   - Automatically send invoices to tenants via in-app and SMS notifications
   - Display a summary of results

## Automated Cron Job

### Vercel Cron (Recommended)

If deploying on Vercel, the cron job is configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/monthly-invoices",
      "schedule": "0 0 1 * *"
    }
  ]
}
```

This runs on the 1st of every month at midnight UTC.

### Environment Variables

Add to your `.env` file:

```bash
# Cron job security
CRON_SECRET=your-secret-key-here
```

The cron endpoint requires this secret in the Authorization header:

```
Authorization: Bearer your-secret-key-here
```

### External Cron Service

If not using Vercel, you can use any cron service (e.g., cron-job.org, EasyCron) to call:

```
POST https://yourdomain.com/api/cron/monthly-invoices
Authorization: Bearer your-secret-key-here
Content-Type: application/json
```

### Cron Schedule

Recommended schedule: `0 0 1 * *` (1st of every month at midnight UTC)

You can adjust the schedule in `vercel.json` or your cron service:

- `0 0 1 * *` - 1st of every month
- `0 0 * * 1` - Every Monday at midnight
- `0 9 1 * *` - 1st of every month at 9 AM UTC

## API Endpoints

### Manual Trigger (Authenticated)

- **POST** `/api/admin/billing/generate-monthly`
- Requires: ORG_ADMIN or ACCOUNTANT permission
- Generates invoices for the current organization only

### Cron Job (Protected by Secret)

- **POST** `/api/cron/monthly-invoices`
- Requires: `Authorization: Bearer {CRON_SECRET}` header
- Generates invoices for all active organizations

## Features

- ✅ Generates invoices for all active leases
- ✅ Handles partial periods (lease starts/ends mid-month)
- ✅ Prevents duplicate invoices (unless `forceRegenerate` is true)
- ✅ Automatically sends invoices to tenants
- ✅ Processes multiple organizations in parallel
- ✅ Comprehensive error handling and logging

## Testing

To test the cron endpoint manually:

```bash
curl -X POST https://yourdomain.com/api/cron/monthly-invoices \
  -H "Authorization: Bearer your-secret-key-here" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Monitoring

Check logs for:

- `[Cron] Starting monthly invoice generation...`
- `[Cron] Monthly invoice generation completed:`
- `[Scheduled Invoice Generation] Processing organization:`
- `[Scheduled Invoice Generation] Completed for organization:`
