# Production Monitoring Guide

This guide explains how to monitor the notification system in production, track delivery rates, and set up alerts for failures.

## Monitoring Endpoints

### Notification Statistics

**Endpoint:** `GET /api/monitoring/notifications/stats`

**Authentication:** Requires ORG_ADMIN or SUPER_ADMIN role

**Response:**

```json
{
  "summary": {
    "total": 150,
    "last24Hours": 12,
    "last7Days": 45
  },
  "delivery": {
    "inApp": {
      "sent": 150
    },
    "email": {
      "sent": 120,
      "delivered": 115,
      "deliveryRate": 95.83
    },
    "sms": {
      "sent": 80,
      "delivered": 75,
      "deliveryRate": 93.75
    }
  },
  "byType": [
    { "type": "payment_received", "count": 50 },
    { "type": "invoice_created", "count": 40 }
  ],
  "errors": {
    "failedDeliveries": 5
  },
  "timestamp": "2025-11-17T20:00:00.000Z"
}
```

**Usage:**

```bash
curl -X GET "https://your-domain.com/api/monitoring/notifications/stats" \
  -H "Cookie: bms_session=YOUR_SESSION_TOKEN"
```

## Setting Up Monitoring

### 1. Health Checks

#### Application Health

**Endpoint:** `GET /api/health`

Monitor this endpoint to ensure the application is running:

```bash
# Simple health check
curl https://your-domain.com/api/health

# Expected response: {"status": "ok"}
```

#### Database Health

The health endpoint also checks database connectivity.

### 2. Notification Delivery Monitoring

#### Track Delivery Rates

Monitor the delivery rates for each channel:

- **In-App:** Should be 100% (always succeeds)
- **Email:** Target >95% delivery rate
- **WhatsApp/SMS:** Target >90% delivery rate

#### Set Up Alerts

**Low Delivery Rate Alert:**

```javascript
// Example alert condition
if (emailDeliveryRate < 90) {
  // Send alert (email, Slack, PagerDuty, etc.)
}
```

**High Failure Rate Alert:**

```javascript
// Example alert condition
if (failedDeliveries > 10 && failedDeliveries / totalNotifications > 0.1) {
  // Send alert
}
```

### 3. Cron Job Monitoring

#### Monitor Cron Job Execution

**Payment Due Reminders:**

```bash
# Check cron job execution
curl -X GET "https://your-domain.com/api/cron/payment-due-reminders" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Lease Expiring Reminders:**

```bash
curl -X GET "https://your-domain.com/api/cron/lease-expiring-reminders" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Expected Response:**

```json
{
  "message": "Payment due reminders cron job completed.",
  "remindersSent": 5
}
```

#### Set Up Cron Job Alerts

Monitor cron job execution to ensure they run daily:

1. **Check Execution Logs:** Verify cron jobs are executing
2. **Monitor Response Times:** Ensure jobs complete within reasonable time
3. **Alert on Failures:** Set up alerts if cron jobs fail

### 4. Error Monitoring

#### Track Failed Deliveries

Monitor the `errors.failedDeliveries` field in the stats endpoint:

```bash
# Get notification stats
STATS=$(curl -s "https://your-domain.com/api/monitoring/notifications/stats" \
  -H "Cookie: bms_session=YOUR_SESSION")

FAILED=$(echo "$STATS" | jq '.errors.failedDeliveries')

if [ "$FAILED" -gt 10 ]; then
  echo "Alert: High number of failed deliveries: $FAILED"
fi
```

#### Common Error Scenarios

1. **Email Failures:**
   - Invalid email addresses
   - Gmail App Password expired
   - Rate limiting

2. **WhatsApp Failures:**
   - Invalid phone numbers
   - API key expired
   - Provider rate limiting
   - Unsupported phone number format

3. **Database Errors:**
   - Connection issues
   - Query timeouts
   - Index problems

## Monitoring Tools Integration

### 1. Vercel Analytics

If using Vercel, enable Vercel Analytics to monitor:

- API endpoint performance
- Error rates
- Response times

### 2. External Monitoring Services

#### Uptime Robot

Monitor health endpoint:

- URL: `https://your-domain.com/api/health`
- Interval: 5 minutes
- Alert on: Down for 2 consecutive checks

#### Pingdom / StatusCake

Similar setup for uptime monitoring.

#### Application Performance Monitoring (APM)

**Sentry:**

```javascript
// Add to error handlers
import * as Sentry from "@sentry/nextjs";

try {
  await sendNotification(...);
} catch (error) {
  Sentry.captureException(error);
}
```

**Datadog / New Relic:**

- Monitor API response times
- Track error rates
- Set up custom dashboards

### 3. Log Aggregation

#### Centralized Logging

**Options:**

- **Vercel Logs:** Built-in for Vercel deployments
- **Logtail / LogRocket:** Real-time log monitoring
- **CloudWatch:** AWS logging
- **Google Cloud Logging:** GCP logging

**Key Logs to Monitor:**

```
[WhatsAppProvider] Failed to send WhatsApp
[EmailProvider] Error sending email
[NotificationService] Failed to send notification
[Notifications] Error in notify*
```

## Alerting Setup

### 1. Email Alerts

Set up email alerts for critical failures:

```typescript
// Example alert function
async function sendAlert(subject: string, message: string) {
  // Send to admin email
  await emailProvider.sendEmail(process.env.ADMIN_EMAIL!, `[BMS Alert] ${subject}`, message);
}
```

### 2. Slack Integration

**Slack Webhook:**

```bash
# Set up Slack webhook
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Send alert
curl -X POST "$SLACK_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Alert: Notification delivery rate dropped below 90%"
  }'
```

### 3. PagerDuty / Opsgenie

For critical alerts, integrate with PagerDuty or Opsgenie:

```typescript
// Example PagerDuty integration
async function triggerPagerDutyAlert(severity: string, message: string) {
  await fetch(process.env.PAGERDUTY_WEBHOOK_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      routing_key: process.env.PAGERDUTY_ROUTING_KEY,
      event_action: 'trigger',
      payload: {
        summary: message,
        severity,
        source: 'BMS Notification System',
      },
    }),
  });
}
```

## Dashboard Setup

### 1. Create Monitoring Dashboard

**Key Metrics to Display:**

1. **Notification Volume:**
   - Total notifications (last 24h, 7d, 30d)
   - Notifications by type

2. **Delivery Rates:**
   - Email delivery rate
   - WhatsApp delivery rate
   - In-app delivery rate

3. **Error Rates:**
   - Failed deliveries
   - Error types breakdown

4. **Cron Job Status:**
   - Last execution time
   - Reminders sent
   - Execution duration

### 2. Grafana Dashboard (Optional)

If using Grafana, create a dashboard with:

- Notification volume over time
- Delivery rate trends
- Error rate trends
- Cron job execution status

## Best Practices

### 1. Regular Monitoring

- **Daily:** Check delivery rates and error counts
- **Weekly:** Review trends and identify patterns
- **Monthly:** Analyze overall system health

### 2. Proactive Alerts

Set up alerts before issues become critical:

- Delivery rate drops below threshold
- Error rate increases
- Cron jobs fail
- API response times increase

### 3. Log Retention

- Keep logs for at least 30 days
- Archive older logs for compliance
- Set up log rotation

### 4. Performance Monitoring

- Monitor API response times
- Track database query performance
- Monitor external API calls (email, WhatsApp)

## Troubleshooting

### Low Email Delivery Rate

1. Check Gmail App Password validity
2. Verify email addresses are correct
3. Check for rate limiting
4. Review email provider logs

### Low WhatsApp Delivery Rate

1. Verify API credentials
2. Check phone number formats
3. Review provider rate limits
4. Check provider status page

### Cron Jobs Not Running

1. Verify cron service is configured
2. Check CRON_SECRET is correct
3. Review cron service logs
4. Test endpoints manually

## Example Monitoring Script

```bash
#!/bin/bash
# monitor-notifications.sh

DOMAIN="https://your-domain.com"
SESSION_TOKEN="YOUR_SESSION_TOKEN"

# Get stats
STATS=$(curl -s "$DOMAIN/api/monitoring/notifications/stats" \
  -H "Cookie: bms_session=$SESSION_TOKEN")

# Extract metrics
EMAIL_RATE=$(echo "$STATS" | jq '.delivery.email.deliveryRate')
SMS_RATE=$(echo "$STATS" | jq '.delivery.sms.deliveryRate')
FAILED=$(echo "$STATS" | jq '.errors.failedDeliveries')

# Check thresholds
if (( $(echo "$EMAIL_RATE < 90" | bc -l) )); then
  echo "ALERT: Email delivery rate is $EMAIL_RATE% (below 90%)"
fi

if (( $(echo "$SMS_RATE < 85" | bc -l) )); then
  echo "ALERT: SMS delivery rate is $SMS_RATE% (below 85%)"
fi

if [ "$FAILED" -gt 10 ]; then
  echo "ALERT: $FAILED failed deliveries detected"
fi

echo "Monitoring complete"
```

## Next Steps

1. **Set up monitoring dashboard** using your preferred tool
2. **Configure alerts** for critical metrics
3. **Set up log aggregation** for centralized logging
4. **Create runbooks** for common issues
5. **Schedule regular reviews** of monitoring data
