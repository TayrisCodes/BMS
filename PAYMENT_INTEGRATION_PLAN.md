# Payment Integration Plan: Chapa & SantimPay

## Executive Summary

This document outlines the comprehensive plan for integrating **Chapa** and **SantimPay** payment gateways into the BMS (Building Management System) application. The integration will enable tenants to make payments for invoices using these popular Ethiopian payment providers.

---

## 1. Current State Analysis

### 1.1 Existing Payment Infrastructure

**Architecture Overview:**
- **Payment Intent System**: The system uses a payment intent pattern where:
  - Payment intents are created before actual payment processing
  - Payment intents track status: `pending`, `processing`, `completed`, `failed`, `cancelled`
  - Payment intents expire after 30 minutes (configurable)

**Current Payment Flow:**
1. Tenant initiates payment via `/api/tenant/payments/intent` endpoint
2. System creates a `PaymentIntent` record in MongoDB
3. Payment provider is invoked via `PaymentIntentService.createAndInitiatePayment()`
4. Provider returns `redirectUrl` or `paymentInstructions`
5. Tenant completes payment on provider's platform
6. Provider sends webhook to `/api/webhooks/payments/[provider]`
7. System verifies payment and creates `Payment` record
8. Invoice status is automatically updated if fully paid

**Existing Payment Models:**
- **PaymentIntent** (`src/modules/payments/payment-intent.ts`):
  - Tracks payment initiation state
  - Stores provider metadata, redirect URLs, reference numbers
  - Links to invoices and tenants

- **Payment** (`src/lib/payments/payments.ts`):
  - Records completed payments
  - Supports multiple payment methods: `cash`, `bank_transfer`, `telebirr`, `cbe_birr`, `chapa`, `hellocash`, `other`
  - Includes idempotency checks via `referenceNumber`
  - Automatically updates invoice status when fully paid

**Current Provider Implementation:**
- **Base Provider Interface** (`src/modules/payments/providers/base.ts`):
  - `initiatePayment(intent: PaymentIntent): Promise<PaymentInitiationResult>`
  - `verifyPayment(reference: string, metadata?: Record<string, unknown>): Promise<PaymentVerificationResult>`
  - `getProviderName(): string`
  - `isEnabled(): boolean`

- **Existing Providers** (all currently mock implementations):
  - `TelebirrProvider` - Mock implementation
  - `CbeBirrProvider` - Mock implementation
  - `ChapaProvider` - Mock implementation (needs real integration)
  - `HelloCashProvider` - Mock implementation
  - `MockPaymentProvider` - For development/testing

**Webhook Handler:**
- Located at `/app/api/webhooks/payments/[provider]/route.ts`
- Currently handles all providers generically
- Extracts reference number from webhook payload
- Verifies payment via provider's `verifyPayment()` method
- Creates payment record and updates invoice status

**Database Collections:**
- `payment_intents` - Stores payment intent records
- `payments` - Stores completed payment records
- Indexes are properly set up for efficient queries

### 1.2 Current Limitations

1. **Chapa Integration**: Currently mock only - needs real API integration
2. **SantimPay**: Not implemented at all - needs full integration
3. **Webhook Security**: Signature verification not implemented (marked as TODO)
4. **Error Handling**: Basic error handling exists but could be more robust
5. **Retry Logic**: No retry mechanism for failed webhook processing
6. **Configuration**: Provider credentials stored in environment variables (needs organization-level configuration)

---

## 2. Integration Requirements

### 2.1 Chapa Integration Requirements

**API Documentation:**
- Chapa provides REST API for payment processing
- Dashboard: https://dashboard.chapa.co/
- API endpoints for:
  - Transaction initialization
  - Transaction verification
  - Webhook callbacks

**Required Credentials:**
- `CHAPA_SECRET_KEY` - Secret API key from Chapa dashboard
- `CHAPA_PUBLIC_KEY` - Public key (optional, for client-side)
- `CHAPA_WEBHOOK_SECRET` - For webhook signature verification

**Integration Features Needed:**
1. **Payment Initiation:**
   - Create payment request with amount, currency, customer info
   - Generate payment link/redirect URL
   - Return reference number for tracking

2. **Payment Verification:**
   - Verify transaction status using reference number
   - Handle both webhook and manual verification

3. **Webhook Handling:**
   - Verify webhook signature for security
   - Process payment status updates
   - Handle idempotency

**Chapa API Flow:**
```
1. POST /transaction/initialize
   - Request: { amount, currency, email, first_name, last_name, phone_number, tx_ref, callback_url, return_url }
   - Response: { status, message, data: { checkout_url, tx_ref } }

2. GET /transaction/verify/{tx_ref}
   - Response: { status, message, data: { transaction details } }

3. Webhook: POST to callback_url
   - Payload: { event, data: { transaction details } }
   - Headers: X-Chapa-Signature (HMAC signature)
```

### 2.2 SantimPay Integration Requirements

**API Documentation:**
- SantimPay provides REST API for payment processing
- Registration required to obtain credentials
- Supports multiple payment methods (Telebirr, CBE, M-Pesa, etc.)

**Required Credentials:**
- `SANTIMPAY_MERCHANT_ID` - Merchant identifier
- `SANTIMPAY_PRIVATE_KEY` - Private key for API authentication
- `SANTIMPAY_WEBHOOK_SECRET` - For webhook signature verification

**Integration Features Needed:**
1. **Payment Initiation:**
   - Create payment request
   - Generate payment link or redirect URL
   - Support for multiple payment methods

2. **Payment Verification:**
   - Verify transaction using reference number
   - Check payment status

3. **Webhook Handling:**
   - Verify webhook signature
   - Process payment notifications
   - Handle idempotency

**SantimPay API Flow:**
```
1. POST /api/v1/payment/initiate
   - Request: { amount, currency, payment_method, customer_info, callback_url, return_url }
   - Response: { success, payment_url, transaction_id, reference }

2. GET /api/v1/payment/verify/{transaction_id}
   - Response: { success, transaction: { status, amount, reference } }

3. Webhook: POST to callback_url
   - Payload: { event, transaction: { details } }
   - Headers: X-SantimPay-Signature (signature)
```

---

## 3. Implementation Plan

### 3.1 Phase 1: Chapa Integration

#### Step 1.1: Update Chapa Provider Implementation

**File:** `src/modules/payments/providers/chapa.ts`

**Tasks:**
1. Install Chapa SDK or implement HTTP client
2. Implement `initiatePayment()` method:
   - Call Chapa API to initialize transaction
   - Generate unique `tx_ref` (transaction reference)
   - Include callback URL for webhooks
   - Return `redirectUrl` and `referenceNumber`
3. Implement `verifyPayment()` method:
   - Call Chapa verification API
   - Verify transaction status and amount
   - Return verification result
4. Add webhook signature verification helper
5. Handle errors appropriately

**Implementation Details:**
```typescript
// Environment variables needed:
// CHAPA_SECRET_KEY
// CHAPA_WEBHOOK_SECRET
// CHAPA_BASE_URL (default: https://api.chapa.co/v1)

// Transaction initialization:
const response = await fetch(`${CHAPA_BASE_URL}/transaction/initialize`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${CHAPA_SECRET_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    amount: intent.amount,
    currency: intent.currency,
    email: tenant.email,
    first_name: tenant.firstName,
    last_name: tenant.lastName,
    phone_number: tenant.phone,
    tx_ref: `BMS-${intent._id}-${Date.now()}`,
    callback_url: `${process.env.NEXT_PUBLIC_API_URL}/api/webhooks/payments/chapa`,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/tenant/payments?status=success`,
  }),
});
```

#### Step 1.2: Update Webhook Handler for Chapa

**File:** `app/api/webhooks/payments/chapa/route.ts` (or update existing handler)

**Tasks:**
1. Extract webhook payload
2. Verify HMAC signature using `CHAPA_WEBHOOK_SECRET`
3. Extract `tx_ref` from payload
4. Find payment intent by reference
5. Verify payment via Chapa API
6. Create payment record
7. Update invoice status

**Webhook Signature Verification:**
```typescript
import crypto from 'crypto';

function verifyChapaWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const calculatedSignature = hmac.digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(calculatedSignature)
  );
}
```

#### Step 1.3: Update Payment Intent Types

**File:** `src/modules/payments/payment-intent.ts`

**Tasks:**
1. Ensure `chapa` is included in `PaymentProvider` type
2. Verify payment intent model supports all required fields

#### Step 1.4: Add Environment Variables

**File:** `.env.development.local` and production config

**Variables:**
```bash
# Chapa Configuration
CHAPA_ENABLED=true
CHAPA_SECRET_KEY=your_secret_key_here
CHAPA_PUBLIC_KEY=your_public_key_here
CHAPA_WEBHOOK_SECRET=your_webhook_secret_here
CHAPA_BASE_URL=https://api.chapa.co/v1
```

### 3.2 Phase 2: SantimPay Integration

#### Step 2.1: Create SantimPay Provider

**File:** `src/modules/payments/providers/santimpay.ts` (NEW)

**Tasks:**
1. Create new `SantimPayProvider` class extending `BasePaymentProvider`
2. Implement `initiatePayment()` method:
   - Call SantimPay API to initiate payment
   - Generate unique transaction reference
   - Include callback URL
   - Return redirect URL and reference number
3. Implement `verifyPayment()` method:
   - Call SantimPay verification API
   - Verify transaction status
   - Return verification result
4. Add webhook signature verification helper
5. Handle errors appropriately

**Implementation Structure:**
```typescript
export class SantimPayProvider extends BasePaymentProvider {
  getProviderName(): string {
    return 'SantimPay';
  }

  isEnabled(): boolean {
    return process.env.SANTIMPAY_ENABLED === 'true';
  }

  async initiatePayment(intent: PaymentIntent): Promise<PaymentInitiationResult> {
    // Implementation
  }

  async verifyPayment(
    reference: string,
    metadata?: Record<string, unknown>
  ): Promise<PaymentVerificationResult> {
    // Implementation
  }
}
```

#### Step 2.2: Register SantimPay Provider

**File:** `src/modules/payments/providers/index.ts`

**Tasks:**
1. Import `SantimPayProvider`
2. Add `santimpay` case to `getPaymentProvider()` function
3. Add `santimpay` to `getAvailableProviders()` array
4. Export `SantimPayProvider`

#### Step 2.3: Update Payment Types

**File:** `src/modules/payments/payment-intent.ts`

**Tasks:**
1. Add `santimpay` to `PaymentProvider` type union
2. Ensure all types support the new provider

**File:** `src/lib/payments/payments.ts`

**Tasks:**
1. Add `santimpay` to `PaymentMethod` type union

#### Step 2.4: Create Webhook Handler for SantimPay

**File:** `app/api/webhooks/payments/santimpay/route.ts` (NEW, or update existing)

**Tasks:**
1. Create webhook endpoint for SantimPay
2. Verify webhook signature
3. Extract transaction reference
4. Find payment intent
5. Verify payment
6. Create payment record
7. Update invoice status

#### Step 2.5: Add Environment Variables

**Variables:**
```bash
# SantimPay Configuration
SANTIMPAY_ENABLED=true
SANTIMPAY_MERCHANT_ID=your_merchant_id
SANTIMPAY_PRIVATE_KEY=your_private_key
SANTIMPAY_WEBHOOK_SECRET=your_webhook_secret
SANTIMPAY_BASE_URL=https://api.santimpay.com/api/v1
```

### 3.3 Phase 3: Enhanced Features

#### Step 3.1: Webhook Security Enhancement

**Tasks:**
1. Implement signature verification for all providers
2. Add retry logic for failed webhook processing
3. Add webhook logging and monitoring
4. Implement idempotency checks at webhook level

#### Step 3.2: Error Handling & Retry Logic

**Tasks:**
1. Add retry mechanism for failed API calls
2. Implement exponential backoff
3. Add comprehensive error logging
4. Create error notification system

#### Step 3.3: Configuration Management

**Tasks:**
1. Consider organization-level payment provider configuration
2. Add UI for admins to configure payment providers
3. Support multiple provider configurations per organization

#### Step 3.4: Testing & Documentation

**Tasks:**
1. Write unit tests for provider implementations
2. Write integration tests for payment flow
3. Test webhook handling with mock webhooks
4. Document API endpoints and integration steps
5. Create developer guide for adding new providers

---

## 4. Detailed Implementation Steps

### 4.1 Chapa Integration - Detailed Steps

#### Step 1: Install Dependencies (if needed)

```bash
# If using Chapa SDK (if available)
npm install @chapa/chapa

# Or use native fetch/axios for HTTP requests
# (Already available in Next.js)
```

#### Step 2: Implement Chapa Provider

**File:** `src/modules/payments/providers/chapa.ts`

**Key Implementation Points:**
1. **initiatePayment():**
   - Validate payment intent
   - Prepare Chapa API request payload
   - Include tenant information (email, name, phone)
   - Generate unique `tx_ref` (format: `BMS-{intentId}-{timestamp}`)
   - Set callback URL: `${NEXT_PUBLIC_API_URL}/api/webhooks/payments/chapa`
   - Set return URL: `${NEXT_PUBLIC_APP_URL}/tenant/payments?status=success`
   - Make API call to Chapa
   - Handle errors (network, API errors)
   - Return `PaymentInitiationResult` with `redirectUrl` and `referenceNumber`

2. **verifyPayment():**
   - Call Chapa verification API with reference number
   - Verify transaction status (`success`, `failed`, `pending`)
   - Verify amount matches intent amount
   - Return `PaymentVerificationResult`

3. **Webhook Signature Verification:**
   - Extract signature from `X-Chapa-Signature` header
   - Calculate HMAC SHA256 of request body
   - Compare signatures using timing-safe comparison

#### Step 3: Update Webhook Handler

**File:** `app/api/webhooks/payments/[provider]/route.ts`

**Enhancements:**
1. Add provider-specific signature verification
2. Extract reference number based on provider format
3. Handle Chapa-specific webhook payload structure
4. Add logging for debugging

### 4.2 SantimPay Integration - Detailed Steps

#### Step 1: Research SantimPay API

**Tasks:**
1. Review SantimPay API documentation
2. Understand authentication mechanism
3. Understand webhook format
4. Identify required fields for payment initiation

#### Step 2: Create SantimPay Provider

**File:** `src/modules/payments/providers/santimpay.ts`

**Implementation similar to Chapa but adapted for SantimPay API:**
1. Use SantimPay API endpoints
2. Implement SantimPay authentication (likely API key or JWT)
3. Format requests according to SantimPay specification
4. Handle SantimPay-specific response format

#### Step 3: Register Provider

**File:** `src/modules/payments/providers/index.ts`

```typescript
import { SantimPayProvider } from './santimpay';

export function getPaymentProvider(provider: ProviderType): PaymentProvider {
  switch (provider) {
    // ... existing cases
    case 'santimpay':
      return new SantimPayProvider();
    // ...
  }
}

export function getAvailableProviders(): ProviderType[] {
  return ['telebirr', 'cbe_birr', 'chapa', 'hellocash', 'santimpay', 'bank_transfer'];
}
```

#### Step 4: Update Types

**File:** `src/modules/payments/payment-intent.ts`

```typescript
export type PaymentProvider = 
  | 'telebirr' 
  | 'cbe_birr' 
  | 'chapa' 
  | 'hellocash' 
  | 'santimpay'  // Add this
  | 'bank_transfer';
```

**File:** `src/lib/payments/payments.ts`

```typescript
export type PaymentMethod =
  | 'cash'
  | 'bank_transfer'
  | 'telebirr'
  | 'cbe_birr'
  | 'chapa'
  | 'hellocash'
  | 'santimpay'  // Add this
  | 'other';
```

---

## 5. Testing Strategy

### 5.1 Unit Tests

**Files to Test:**
1. `src/modules/payments/providers/chapa.ts`
   - Test `initiatePayment()` with various scenarios
   - Test `verifyPayment()` with success/failure cases
   - Test signature verification

2. `src/modules/payments/providers/santimpay.ts`
   - Same as Chapa

3. `src/modules/payments/payment-intent-service.ts`
   - Test payment intent creation and initiation flow

### 5.2 Integration Tests

**Test Scenarios:**
1. **Complete Payment Flow:**
   - Create payment intent
   - Initiate payment with provider
   - Simulate webhook callback
   - Verify payment record created
   - Verify invoice status updated

2. **Error Scenarios:**
   - Provider API failure
   - Invalid webhook signature
   - Duplicate payment (idempotency)
   - Expired payment intent

3. **Webhook Handling:**
   - Valid webhook with successful payment
   - Valid webhook with failed payment
   - Invalid webhook signature
   - Missing payment intent

### 5.3 Manual Testing

**Test Checklist:**
- [ ] Create payment intent via API
- [ ] Verify redirect URL is returned
- [ ] Complete payment on provider's platform
- [ ] Verify webhook is received
- [ ] Verify payment record is created
- [ ] Verify invoice status is updated
- [ ] Test error scenarios
- [ ] Test idempotency (duplicate webhook)

### 5.4 Sandbox/Test Environment

**Chapa:**
- Use Chapa sandbox/test credentials
- Test with small amounts
- Verify webhook callbacks work

**SantimPay:**
- Use SantimPay test environment
- Test payment flow end-to-end
- Verify webhook handling

---

## 6. Security Considerations

### 6.1 API Key Management

**Current Approach:**
- API keys stored in environment variables
- Accessible server-side only

**Recommendations:**
1. Never commit API keys to version control
2. Use secure secret management (e.g., Vercel Environment Variables, AWS Secrets Manager)
3. Rotate keys periodically
4. Use different keys for development and production

### 6.2 Webhook Security

**Implementation Requirements:**
1. **Signature Verification:**
   - Always verify webhook signatures
   - Use timing-safe comparison
   - Reject webhooks with invalid signatures

2. **HTTPS Only:**
   - Ensure webhook endpoints are only accessible via HTTPS
   - Use secure callback URLs

3. **Idempotency:**
   - Check for duplicate webhook processing
   - Use reference numbers to prevent duplicate payments

### 6.3 Data Protection

**Requirements:**
1. Encrypt sensitive data in transit (HTTPS)
2. Log payment data securely (avoid logging full card numbers)
3. Comply with PCI DSS if handling card data (though providers handle this)
4. Implement rate limiting on webhook endpoints

---

## 7. Configuration & Environment Setup

### 7.1 Environment Variables

**Development (.env.development.local):**
```bash
# Chapa
CHAPA_ENABLED=true
CHAPA_SECRET_KEY=test_secret_key
CHAPA_PUBLIC_KEY=test_public_key
CHAPA_WEBHOOK_SECRET=test_webhook_secret
CHAPA_BASE_URL=https://api.chapa.co/v1

# SantimPay
SANTIMPAY_ENABLED=true
SANTIMPAY_MERCHANT_ID=test_merchant_id
SANTIMPAY_PRIVATE_KEY=test_private_key
SANTIMPAY_WEBHOOK_SECRET=test_webhook_secret
SANTIMPAY_BASE_URL=https://api.santimpay.com/api/v1

# Application URLs
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Production:**
- Use production API keys
- Use production base URLs
- Ensure webhook URLs are publicly accessible
- Use HTTPS for all URLs

### 7.2 Provider Configuration

**Future Enhancement:**
- Store provider configuration in database (organization-level)
- Allow admins to configure providers per organization
- Support multiple active providers simultaneously

---

## 8. Error Handling & Logging

### 8.1 Error Types

**Provider Errors:**
- API connection failures
- Invalid API responses
- Authentication failures
- Rate limiting

**Payment Errors:**
- Invalid payment intent
- Expired payment intent
- Amount mismatch
- Duplicate payment

**Webhook Errors:**
- Invalid signature
- Missing payment intent
- Payment verification failure

### 8.2 Logging Strategy

**Log Levels:**
- **INFO**: Payment initiated, payment completed
- **WARN**: Payment verification failed, webhook signature invalid
- **ERROR**: API failures, unexpected errors

**Log Information:**
- Payment intent ID
- Reference number
- Provider name
- Amount
- Tenant ID
- Invoice ID (if applicable)
- Error messages (sanitized)

### 8.3 Monitoring

**Metrics to Track:**
- Payment initiation success rate
- Payment completion rate
- Webhook processing time
- Error rates by provider
- Average payment amount

---

## 9. Rollout Plan

### 9.1 Development Phase

1. **Week 1: Chapa Integration**
   - Implement Chapa provider
   - Update webhook handler
   - Write unit tests
   - Manual testing in sandbox

2. **Week 2: SantimPay Integration**
   - Research SantimPay API
   - Implement SantimPay provider
   - Update webhook handler
   - Write unit tests
   - Manual testing

3. **Week 3: Testing & Refinement**
   - Integration testing
   - Error handling improvements
   - Security enhancements
   - Documentation

### 9.2 Staging Phase

1. Deploy to staging environment
2. End-to-end testing with real provider sandboxes
3. Load testing
4. Security audit

### 9.3 Production Phase

1. Deploy to production
2. Monitor closely for first week
3. Gradual rollout (enable for test organizations first)
4. Full rollout after validation

---

## 10. Documentation Requirements

### 10.1 Developer Documentation

1. **API Documentation:**
   - Payment intent creation endpoint
   - Webhook endpoints
   - Error codes and responses

2. **Integration Guide:**
   - How to add a new payment provider
   - Provider interface requirements
   - Testing guidelines

### 10.2 User Documentation

1. **Admin Guide:**
   - How to configure payment providers
   - How to view payment history
   - How to handle payment issues

2. **Tenant Guide:**
   - How to make payments
   - Supported payment methods
   - Payment troubleshooting

---

## 11. Success Criteria

### 11.1 Functional Requirements

- [ ] Chapa payment integration working end-to-end
- [ ] SantimPay payment integration working end-to-end
- [ ] Webhook handling secure and reliable
- [ ] Payment records created correctly
- [ ] Invoice status updated automatically
- [ ] Error handling robust

### 11.2 Non-Functional Requirements

- [ ] Payment initiation < 2 seconds
- [ ] Webhook processing < 5 seconds
- [ ] 99.9% webhook delivery success rate
- [ ] Zero duplicate payments
- [ ] All security requirements met

---

## 12. Future Enhancements

### 12.1 Short-term (Next 3 months)

1. **Organization-level Configuration:**
   - Allow each organization to configure their own provider credentials
   - Support multiple active providers per organization

2. **Payment Method Preferences:**
   - Allow tenants to save preferred payment methods
   - Quick payment option for recurring invoices

3. **Payment Analytics:**
   - Dashboard showing payment trends
   - Provider performance metrics

### 12.2 Long-term (6+ months)

1. **Recurring Payments:**
   - Automatic payment scheduling
   - Payment method tokenization

2. **Multi-currency Support:**
   - Support for USD and other currencies
   - Currency conversion handling

3. **Payment Splitting:**
   - Split payments across multiple invoices
   - Partial payment handling improvements

---

## 13. Risk Assessment & Mitigation

### 13.1 Technical Risks

**Risk: Provider API Changes**
- **Impact**: High
- **Probability**: Medium
- **Mitigation**: Abstract provider interface, version API calls, monitor provider updates

**Risk: Webhook Delivery Failures**
- **Impact**: High
- **Probability**: Low
- **Mitigation**: Implement retry logic, manual verification endpoint, monitoring

**Risk: Security Vulnerabilities**
- **Impact**: Critical
- **Probability**: Low
- **Mitigation**: Security audit, signature verification, HTTPS only, regular updates

### 13.2 Business Risks

**Risk: Provider Service Outages**
- **Impact**: High
- **Probability**: Low
- **Mitigation**: Support multiple providers, fallback mechanisms, status monitoring

**Risk: Regulatory Changes**
- **Impact**: Medium
- **Probability**: Low
- **Mitigation**: Stay updated with regulations, flexible architecture

---

## 14. Appendix

### 14.1 Chapa API Reference

**Base URL:** `https://api.chapa.co/v1`

**Endpoints:**
- `POST /transaction/initialize` - Initialize payment
- `GET /transaction/verify/{tx_ref}` - Verify transaction

**Authentication:** Bearer token in Authorization header

### 14.2 SantimPay API Reference

**Base URL:** `https://api.santimpay.com/api/v1` (verify actual URL)

**Endpoints:**
- `POST /payment/initiate` - Initialize payment
- `GET /payment/verify/{transaction_id}` - Verify transaction

**Authentication:** (Verify actual method from documentation)

### 14.3 Useful Links

- Chapa Dashboard: https://dashboard.chapa.co/
- Chapa Documentation: https://developer.chapa.co/
- SantimPay: (Add when available)

---

## Conclusion

This plan provides a comprehensive roadmap for integrating Chapa and SantimPay payment gateways into the BMS application. The implementation follows the existing payment architecture and extends it to support these new providers while maintaining security, reliability, and scalability.

The phased approach allows for incremental development and testing, reducing risk and ensuring quality at each step. Regular monitoring and documentation will ensure the integration remains maintainable and extensible for future enhancements.




















