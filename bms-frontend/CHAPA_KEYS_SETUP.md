# Chapa Payment Keys Setup

This guide explains how to set up and manage Chapa payment keys in the BMS system.

## Setting Up Chapa Keys

### Option 1: Using the Settings Page (Recommended)

1. Navigate to **Organization Settings** → **Payment Integration** (`/org/settings/payments`)
2. Find the **Chapa** provider card
3. Toggle the switch to **Enable** Chapa
4. Enter your Chapa credentials:
   - **Secret Key**: Your Chapa secret key (e.g., `CHASECK_TEST-...`)
   - **Public Key**: Your Chapa public key (e.g., `CHAPUBK_TEST-...`)
   - **Webhook Secret**: Your webhook secret for signature verification
5. Click **Save Changes**

### Option 2: Using Environment Variables and Seed Script

1. Set environment variables in `.env.local`:

   ```bash
   CHAPA_SECRET_KEY=CHASECK_TEST-your-secret-key
   CHAPA_PUBLIC_KEY=CHAPUBK_TEST-your-public-key
   CHAPA_WEBHOOK_SECRET=your-webhook-secret
   ```

2. Run the seed script:

   ```bash
   npm run seed:chapa
   ```

   This will automatically populate the Chapa keys in the system settings.

## Getting Chapa Test Keys

1. Sign up for a Chapa account at [https://chapa.co](https://chapa.co)
2. Navigate to your dashboard
3. Go to **Settings** → **API Keys**
4. Copy your **Test Secret Key** and **Test Public Key**
5. For webhook secret, go to **Settings** → **Webhooks** and generate a webhook secret

## Webhook Configuration

After setting up your keys, configure the webhook in your Chapa dashboard:

1. Go to **Settings** → **Webhooks** in Chapa dashboard
2. Add a new webhook with the URL:
   ```
   https://your-domain.com/api/webhooks/payments/chapa
   ```
   Or for local development:
   ```
   http://localhost:3000/api/webhooks/payments/chapa
   ```
3. Set the webhook secret (the same value you entered in the settings)
4. Enable the webhook

## Security Notes

- **Never commit** your Chapa keys to version control
- Use environment variables for production deployments
- The settings page masks secret values (shows only last 4 characters)
- To update a secret, enter a new value (masked values won't be overwritten)

## Testing

After setting up Chapa keys:

1. Enable Chapa in the payment settings
2. Go to an invoice detail page
3. Click **Pay with Chapa** button
4. You should be redirected to Chapa's payment page
5. Complete a test payment
6. The webhook should automatically update the payment status

## Troubleshooting

### Keys not saving

- Ensure you have `settings.write` permission
- Check browser console for errors
- Verify the API endpoint is accessible

### Webhook not working

- Verify the webhook URL is correct in Chapa dashboard
- Check that the webhook secret matches
- Review server logs for webhook errors

### Payment redirect not working

- Ensure Chapa is enabled in settings
- Verify keys are correctly set (not masked)
- Check that the Chapa provider is properly configured

