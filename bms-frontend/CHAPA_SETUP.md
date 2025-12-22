# Chapa Payment Integration Setup

## Environment Variables

Add the following to your `.env` file:

```bash
# Chapa Payment Gateway Configuration
CHAPA_ENABLED=true
CHAPA_SECRET_KEY=CHASECK_TEST-tsoPRqDHfKSTT4DQTHAnciJUkVCMJrmh
CHAPA_PUBLIC_KEY=CHAPUBK_TEST-i0uZsKMIdZVal8Dmf0PLtWF5rtiJozoo
CHAPA_WEBHOOK_SECRET=qB4J7VSs1CvnHvRDb3NRFFpJ
CHAPA_BASE_URL=https://api.chapa.co/v1
```

## Webhook Configuration

1. Log in to your Chapa Dashboard: https://dashboard.chapa.co/
2. Navigate to Settings > Webhooks
3. Add webhook URL: `https://yourdomain.com/api/webhooks/payments/chapa`
4. Set webhook secret (use the same value as `CHAPA_WEBHOOK_SECRET`)

## Testing

- Test mode is automatically enabled when using `CHASECK_TEST-` keys
- In test mode, payments are simulated
- Use Chapa's test cards for testing: https://developer.chapa.co/test-cards

## Production

When ready for production:

1. Replace test keys with live keys from Chapa dashboard
2. Update `CHAPA_SECRET_KEY` and `CHAPA_PUBLIC_KEY` in environment variables
3. Update webhook URL to production domain
4. Test webhook signature verification

## API Endpoints

- **Initialize Payment**: `POST https://api.chapa.co/v1/transaction/initialize`
- **Verify Payment**: `GET https://api.chapa.co/v1/transaction/verify/{tx_ref}`
- **Webhook**: `POST /api/webhooks/payments/chapa`

## Payment Flow

1. Tenant initiates payment → Creates payment intent
2. Chapa provider generates `tx_ref` and calls Chapa API
3. User redirected to Chapa checkout page
4. After payment, Chapa sends webhook to `/api/webhooks/payments/chapa`
5. System verifies webhook signature
6. System verifies payment via Chapa API
7. Payment record created and invoice status updated



