## Phase 6 – Integrations and Advanced Features (Detailed Plan)

### Goals

- Complete payment provider integrations (Telebirr, CBE Birr, Chapa, HelloCash) with real implementations and secure webhook handling.
- Implement notification service with email and SMS support for Ethiopian providers.
- Build reporting UI with CSV/PDF export capabilities for ERCA and auditors.
- Define IoT and advanced security hooks for future integrations.

### Current State Analysis

**✅ Already Implemented:**

- Payment intent system: `src/modules/payments/payment-intent.ts` (abstraction layer).
- Payment provider abstraction: `src/modules/payments/providers/` (base interface, mock provider).
- Webhook handler skeleton: `app/api/webhooks/payments/[provider]/route.ts` (needs completion).
- Notifications API skeleton: `app/api/notifications/route.ts` (references `notifications` collection).
- Financial reporting API: `app/api/reports/financial/route.ts` (returns JSON data).
- Occupancy reporting API: `app/api/reports/occupancy/route.ts` (returns JSON data).

**❌ Needs Implementation:**

- Real payment provider implementations (replace mocks with actual SDKs/APIs).
- Webhook signature verification for security.
- Idempotency handling for payment webhooks.
- Notifications collection with proper schema.
- Notification service with email and SMS providers.
- Event-driven notification triggers.
- Reporting UI for viewing and exporting reports.
- CSV/PDF export functionality.
- IoT endpoints (placeholder for future).

---

### Step 1 – Complete Payment Provider Integrations

- **1.1 Research payment provider APIs**
  - **1.1.1** Research Telebirr API:
    - Documentation, API endpoints, authentication, payment initiation flow.
    - Webhook/callback format, signature verification method.
    - SDK availability or REST API details.
  - **1.1.2** Research CBE Birr API:
    - Same research as Telebirr.
  - **1.1.3** Research Chapa API:
    - Same research as Telebirr.
  - **1.1.4** Research HelloCash API:
    - Same research as Telebirr.

- **1.2 Create provider configuration**
  - **1.2.1** Create `src/modules/payments/providers/config.ts`:
    - Store provider credentials (API keys, secrets) from environment variables.
    - Provider-specific settings (base URLs, timeout, retry logic).
    - Configuration per organization (if different orgs use different provider accounts).

- **1.3 Implement Telebirr provider**
  - **1.3.1** Create `src/modules/payments/providers/telebirr.ts`:
    - Implement `PaymentProvider` interface.
    - `initiatePayment()`: Create payment request via Telebirr API, return redirect URL or payment instructions.
    - `verifyPayment()`: Verify payment status via Telebirr API or webhook payload.
    - `verifyWebhookSignature()`: Verify webhook signature using Telebirr's method.
    - Handle Telebirr-specific error codes and responses.
  - **1.3.2** Add environment variables:
    - `TELEBIRR_API_KEY`, `TELEBIRR_API_SECRET`, `TELEBIRR_BASE_URL`, `TELEBIRR_WEBHOOK_SECRET`.

- **1.4 Implement CBE Birr provider**
  - **1.4.1** Create `src/modules/payments/providers/cbe-birr.ts`:
    - Same structure as Telebirr provider.
    - Implement CBE Birr-specific API calls.
  - **1.4.2** Add environment variables:
    - `CBE_BIRR_API_KEY`, `CBE_BIRR_API_SECRET`, `CBE_BIRR_BASE_URL`, `CBE_BIRR_WEBHOOK_SECRET`.

- **1.5 Implement Chapa provider**
  - **1.5.1** Create `src/modules/payments/providers/chapa.ts`:
    - Same structure as Telebirr provider.
    - Implement Chapa-specific API calls.
  - **1.5.2** Add environment variables:
    - `CHAPA_API_KEY`, `CHAPA_API_SECRET`, `CHAPA_BASE_URL`, `CHAPA_WEBHOOK_SECRET`.

- **1.6 Implement HelloCash provider**
  - **1.6.1** Create `src/modules/payments/providers/hellocash.ts`:
    - Same structure as Telebirr provider.
    - Implement HelloCash-specific API calls.
  - **1.6.2** Add environment variables:
    - `HELLOCASH_API_KEY`, `HELLOCASH_API_SECRET`, `HELLOCASH_BASE_URL`, `HELLOCASH_WEBHOOK_SECRET`.

- **1.7 Update provider factory**
  - **1.7.1** Update `src/modules/payments/providers/index.ts`:
    - `getPaymentProvider()` function returns appropriate provider instance.
    - Fallback to mock provider in development if credentials not configured.

---

### Step 2 – Secure Webhook Handling

- **2.1 Implement webhook signature verification**
  - **2.1.1** Create `src/modules/payments/webhooks/verification.ts`:
    - `verifyWebhookSignature(provider: string, payload: unknown, headers: Headers, secret: string)`: Verify signature.
    - Provider-specific verification methods:
      - Telebirr: HMAC-SHA256 signature.
      - CBE Birr: Provider-specific method.
      - Chapa: Provider-specific method.
      - HelloCash: Provider-specific method.
  - **2.1.2** Update webhook handler:
    - In `app/api/webhooks/payments/[provider]/route.ts`, call signature verification.
    - Return 401 if signature invalid.
    - Log verification failures for monitoring.

- **2.2 Implement idempotency**
  - **2.2.1** Create `src/modules/payments/webhooks/idempotency.ts`:
    - `checkWebhookProcessed(referenceNumber: string, provider: string)`: Check if webhook already processed.
    - Store processed webhook references in `processedWebhooks` collection or cache.
    - TTL for cache entries (e.g., 24 hours).
  - **2.2.2** Update webhook handler:
    - Check idempotency before processing.
    - If already processed, return success (idempotent response).
    - Mark as processed after successful processing.

- **2.3 Webhook retry mechanism**
  - **2.3.1** Create `src/modules/payments/webhooks/retry.ts`:
    - Store failed webhook processing attempts.
    - Retry logic with exponential backoff.
    - Max retry attempts (e.g., 3).
    - Alert if max retries exceeded.

- **2.4 Complete webhook handler**
  - **2.4.1** Update `app/api/webhooks/payments/[provider]/route.ts`:
    - Add signature verification (from Step 2.1).
    - Add idempotency check (from Step 2.2).
    - Add error handling and retry logic.
    - Add comprehensive logging.
    - Ensure payment intent status updates correctly.
    - Ensure payment record creation is atomic.

---

### Step 3 – Notifications Collection and Service

- **3.1 Create notifications collection**
  - **3.1.1** Create `src/lib/notifications/notifications.ts`:
    - Define `Notification` interface:
      ```typescript
      interface Notification {
        _id: string;
        organizationId?: string | null; // Optional, for org-wide notifications
        userId?: string | null; // ObjectId ref to users (optional, for user-specific)
        tenantId?: string | null; // ObjectId ref to tenants (optional, for tenant-specific)
        type:
          | 'invoice_created'
          | 'payment_due'
          | 'payment_received'
          | 'complaint_status_changed'
          | 'work_order_assigned'
          | 'work_order_completed'
          | 'lease_expiring'
          | 'system'
          | 'other';
        title: string;
        message: string;
        channels: Array<'in_app' | 'email' | 'sms'>; // Delivery channels
        deliveryStatus: {
          in_app?: { sent: boolean; read: boolean; readAt?: Date | null };
          email?: { sent: boolean; delivered: boolean; error?: string | null };
          sms?: { sent: boolean; delivered: boolean; error?: string | null };
        };
        link?: string | null; // Deep link to relevant page
        metadata?: Record<string, unknown> | null; // Additional context
        createdAt: Date;
        updatedAt: Date;
      }
      ```
  - **3.1.2** Create collection getter: `getNotificationsCollection()`.
  - **3.1.3** Create indexes:
    - Compound index on `{ userId, read: false, createdAt }` (for unread notifications).
    - Compound index on `{ tenantId, read: false, createdAt }`.
    - Index on `organizationId` (sparse).
    - Index on `type`, `createdAt`.

- **3.2 Notification service**
  - **3.2.1** Create `src/modules/notifications/notification-service.ts`:
    - `createNotification(input: CreateNotificationInput)`: Create notification record.
    - `sendNotification(notification: Notification)`: Send via configured channels (in-app, email, SMS).
    - `markAsRead(notificationId: string, userId: string)`: Mark in-app notification as read.
    - `getUnreadCount(userId: string, tenantId?: string)`: Get count of unread notifications.

- **3.3 Email provider integration**
  - **3.3.1** Research Ethiopian email providers or use international provider:
    - Options: SendGrid, Mailgun, AWS SES, or local Ethiopian email service.
    - For MVP, use SendGrid or similar (can switch later).
  - **3.3.2** Create `src/modules/notifications/providers/email.ts`:
    - `sendEmail(to: string, subject: string, body: string, htmlBody?: string)`: Send email.
    - Handle email templates (for invoice, payment, complaint notifications).
    - Error handling and retry logic.
  - **3.3.3** Add environment variables:
    - `EMAIL_PROVIDER`, `EMAIL_API_KEY`, `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME`.

- **3.4 SMS provider integration**
  - **3.4.1** Research Ethiopian SMS providers:
    - Options: Ethio Telecom SMS gateway, local SMS aggregators.
    - For MVP, use a provider with Ethiopian coverage.
  - **3.4.2** Create `src/modules/notifications/providers/sms.ts`:
    - `sendSMS(to: string, message: string)`: Send SMS.
    - Handle SMS templates (for OTP, payment reminders, etc.).
    - Error handling and retry logic.
    - Support for Amharic, English, Afaan Oromo, Tigrigna (if provider supports Unicode).
  - **3.4.3** Add environment variables:
    - `SMS_PROVIDER`, `SMS_API_KEY`, `SMS_API_SECRET`, `SMS_SENDER_ID`.

- **3.5 Event-driven notifications**
  - **3.5.1** Create `src/modules/notifications/events.ts`:
    - Define notification event types and handlers.
    - Wire up events:
      - Invoice created → notify tenant (email, SMS, in-app).
      - Payment due (X days before) → notify tenant (email, SMS, in-app).
      - Payment received → notify tenant and accountant (in-app).
      - Complaint status changed → notify tenant (in-app, email).
      - Work order assigned → notify technician (in-app, SMS).
      - Work order completed → notify facility manager (in-app).
      - Lease expiring → notify tenant and building manager (email, in-app).
  - **3.5.2** Integrate event triggers:
    - In invoice generation service: trigger `invoice_created` event.
    - In payment creation: trigger `payment_received` event.
    - In complaint status update: trigger `complaint_status_changed` event.
    - In work order assignment: trigger `work_order_assigned` event.
    - Use event emitter or direct function calls.

- **3.6 Scheduled notifications**
  - **3.6.1** Create scheduled job for payment due reminders:
    - Check invoices due in X days (e.g., 3 days, 1 day).
    - Send reminders to tenants.
    - Use Next.js API route with cron trigger or external scheduler.

- **3.7 Update notifications API**
  - **3.7.1** Update `app/api/notifications/route.ts`:
    - Use `getNotificationsCollection()` instead of direct DB access.
    - Filter by `userId` or `tenantId` based on session.
    - Return proper notification objects with delivery status.
  - **3.7.2** Update `app/api/notifications/[id]/read/route.ts`:
    - Use notification service to mark as read.
    - Update delivery status properly.

---

### Step 4 – Reporting UI

- **4.1 Financial reports page**
  - **4.1.1** Create `app/org/reports/financial/page.tsx`:
    - Use existing `/api/reports/financial` endpoint.
    - Display financial summary:
      - Total revenue (with date range selector).
      - Outstanding receivables.
      - Payment breakdown by method (chart).
      - Monthly revenue trends (chart).
    - Date range picker (start date, end date).
    - Building filter (optional, for org-level reports).
    - "Export CSV" and "Export PDF" buttons.

- **4.2 Occupancy reports page**
  - **4.2.1** Create `app/org/reports/occupancy/page.tsx`:
    - Use existing `/api/reports/occupancy` endpoint.
    - Display occupancy metrics:
      - Total units, occupied units, vacancy rate.
      - Occupancy by building (table or chart).
      - Occupancy trends over time (chart).
    - Building filter (optional).
    - "Export CSV" and "Export PDF" buttons.

- **4.3 Operational reports page**
  - **4.3.1** Create `app/org/reports/operational/page.tsx`:
    - Create new API endpoint: `GET /api/reports/operational`.
    - Display:
      - Complaints by status and category.
      - Work orders by status and priority.
      - Average complaint resolution time.
      - Work order completion rate.
    - Date range and building filters.
    - "Export CSV" and "Export PDF" buttons.

- **4.4 Reports navigation**
  - **4.4.1** Create `app/org/reports/page.tsx`:
    - Reports dashboard with links to:
      - Financial Reports.
      - Occupancy Reports.
      - Operational Reports.
    - Quick stats cards.

---

### Step 5 – CSV Export Functionality

- **5.1 Create CSV export service**
  - **5.1.1** Create `src/modules/reports/export/csv.ts`:
    - `exportFinancialReport(data: FinancialReportData, dateRange: { start: Date; end: Date })`: Generate CSV.
    - `exportOccupancyReport(data: OccupancyReportData)`: Generate CSV.
    - `exportOperationalReport(data: OperationalReportData, dateRange: { start: Date; end: Date })`: Generate CSV.
    - Use CSV library (e.g., `csv-writer` or manual CSV generation).

- **5.2 CSV export API endpoints**
  - **5.2.1** Create `app/api/reports/financial/export/csv/route.ts`:
    - `GET`: Generate and return CSV file.
    - Query params: `startDate`, `endDate`, `buildingId` (optional).
    - Set proper headers: `Content-Type: text/csv`, `Content-Disposition: attachment; filename="financial-report-YYYY-MM-DD.csv"`.
  - **5.2.2** Create `app/api/reports/occupancy/export/csv/route.ts`:
    - Same structure as financial export.
  - **5.2.3** Create `app/api/reports/operational/export/csv/route.ts`:
    - Same structure as financial export.

- **5.3 CSV format for ERCA compliance**
  - **5.3.1** Ensure financial CSV includes:
    - Invoice number, date, tenant name, amount, tax (if applicable), payment status.
    - Payment details: date, method, reference number.
    - Organized by date, suitable for accounting software import.
  - **5.3.2** Add metadata row:
    - Report generation date, organization name, period covered.

---

### Step 6 – PDF Export Functionality

- **6.1 Install PDF library**
  - **6.1.1** Install PDF generation library:
    - Options: `pdfkit`, `puppeteer` (HTML to PDF), `jsPDF`, or `@react-pdf/renderer`.
    - Recommendation: `puppeteer` or `@react-pdf/renderer` for React-based PDFs.

- **6.2 Create PDF export service**
  - **6.2.1** Create `src/modules/reports/export/pdf.ts`:
    - `exportFinancialReportPDF(data: FinancialReportData, dateRange: { start: Date; end: Date }, organizationName: string)`: Generate PDF.
    - `exportOccupancyReportPDF(data: OccupancyReportData, organizationName: string)`: Generate PDF.
    - `exportOperationalReportPDF(data: OperationalReportData, dateRange: { start: Date; end: Date }, organizationName: string)`: Generate PDF.
    - Include headers, footers, organization logo (if available).
    - Format suitable for printing and ERCA submission.

- **6.3 PDF export API endpoints**
  - **6.3.1** Create `app/api/reports/financial/export/pdf/route.ts`:
    - `GET`: Generate and return PDF file.
    - Query params: `startDate`, `endDate`, `buildingId` (optional).
    - Set proper headers: `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="financial-report-YYYY-MM-DD.pdf"`.
  - **6.3.2** Create `app/api/reports/occupancy/export/pdf/route.ts`:
    - Same structure as financial export.
  - **6.3.3** Create `app/api/reports/operational/export/pdf/route.ts`:
    - Same structure as financial export.

- **6.4 PDF templates**
  - **6.4.1** Create PDF templates:
    - Financial report template: cover page, summary, detailed tables, charts (if possible).
    - Occupancy report template: summary, building breakdown, trends.
    - Operational report template: complaints, work orders, metrics.
  - **6.4.2** Ensure PDFs are ERCA-compliant:
    - Include organization TIN number.
    - Proper date formatting.
    - Currency formatting (ETB).
    - Professional layout suitable for audit.

---

### Step 7 – Update Reporting UI with Export Buttons

- **7.1 Add export functionality to reports pages**
  - **7.1.1** Update `app/org/reports/financial/page.tsx`:
    - Add "Export CSV" button: calls `/api/reports/financial/export/csv` and triggers download.
    - Add "Export PDF" button: calls `/api/reports/financial/export/pdf` and triggers download.
    - Show loading state during export generation.
    - Handle errors gracefully.
  - **7.1.2** Update `app/org/reports/occupancy/page.tsx`:
    - Same export buttons.
  - **7.1.3** Update `app/org/reports/operational/page.tsx`:
    - Same export buttons.

- **7.2 Export with filters**
  - **7.2.1** Ensure export APIs respect date range and building filters:
    - Pass query parameters from UI to export endpoints.
    - Export only filtered data.

---

### Step 8 – IoT and Advanced Security Hooks (Placeholder)

- **8.1 Define IoT data structures**
  - **8.1.1** Create `src/lib/iot/types.ts`:
    - Define `IoTEvent` interface:
      ```typescript
      interface IoTEvent {
        _id: string;
        organizationId: string;
        buildingId: string;
        deviceId: string; // IoT device identifier
        deviceType: 'meter' | 'sensor' | 'lock' | 'camera' | 'other';
        eventType: 'reading' | 'alert' | 'status_change' | 'motion' | 'other';
        data: Record<string, unknown>; // Device-specific data
        timestamp: Date;
        receivedAt: Date;
      }
      ```
  - **8.1.2** Create `IoTReadings` collection (optional, for future):
    - Store IoT meter readings automatically.
    - Link to meters collection.

- **8.2 Create IoT webhook endpoint**
  - **8.2.1** Create `app/api/webhooks/iot/route.ts`:
    - `POST`: Receive IoT events from external systems.
    - Validate and store events.
    - Process events (e.g., update meter readings, trigger alerts).
    - For MVP, this is a placeholder that logs events.

- **8.3 Define security access control hooks**
  - **8.3.1** Create `src/lib/security/access-control.ts`:
    - Define interfaces for QR/RFID access control (future).
    - Placeholder functions for access validation.
  - **8.3.2** Create `app/api/webhooks/security/access/route.ts`:
    - Placeholder endpoint for access control system integration.
    - For MVP, returns "Not implemented" message.

- **8.4 Visitor QR code generation (future)**
  - **8.4.1** Document future implementation:
    - Tenant can generate visitor QR codes.
    - QR codes include visitor details and time window.
    - Security system scans QR code and validates.
    - Auto-log visitor entry.

---

### Step 9 – Notification Preferences

- **9.1 User notification preferences**
  - **9.1.1** Add notification preferences to user/tenant model:
    - `notificationPreferences`: {
      - `emailEnabled`: boolean,
      - `smsEnabled`: boolean,
      - `inAppEnabled`: boolean,
      - `emailTypes`: string[] (which types to receive via email),
      - `smsTypes`: string[] (which types to receive via SMS),
        }
  - **9.1.2** Create API: `PATCH /api/notifications/preferences`:
    - Update user's notification preferences.
    - Respect preferences when sending notifications.

- **9.2 Notification preferences UI**
  - **9.2.1** Add to tenant profile: `app/tenant/profile/page.tsx`:
    - Notification preferences section.
    - Toggle email, SMS, in-app notifications.
    - Select notification types per channel.
  - **9.2.2** Add to admin user settings (if needed):
    - Similar preferences for staff users.

---

### Step 10 – Phase 6 Exit Criteria

- **10.1 Payment Provider Integrations**
  - ✅ Real provider implementations for Telebirr, CBE Birr, Chapa, HelloCash (or at least one real provider).
  - ✅ Webhook signature verification works correctly.
  - ✅ Idempotency prevents duplicate payment processing.
  - ✅ Payment webhooks update payment intents and create payment records correctly.

- **10.2 Notifications**
  - ✅ Notifications collection with proper schema and indexes.
  - ✅ Notification service can send via in-app, email, and SMS.
  - ✅ Email provider integrated and working.
  - ✅ SMS provider integrated and working (at least one Ethiopian provider).
  - ✅ Event-driven notifications trigger for key events (invoice created, payment due, etc.).
  - ✅ Users can view and mark notifications as read.
  - ✅ Notification preferences are respected.

- **10.3 Reporting and Exports**
  - ✅ Financial reports UI displays data correctly.
  - ✅ Occupancy reports UI displays data correctly.
  - ✅ Operational reports UI displays data correctly.
  - ✅ CSV export works for all report types.
  - ✅ PDF export works for all report types.
  - ✅ Exports are ERCA-compliant and suitable for audit.

- **10.4 IoT Hooks**
  - ✅ IoT webhook endpoint exists (placeholder for future).
  - ✅ Security access control hooks defined (placeholder for future).

---

## Implementation Notes

- **Payment Provider Integration:**
  - Start with one provider (e.g., Chapa or Telebirr) to validate the approach.
  - Use provider sandbox/test environments for development.
  - Handle provider-specific quirks (different webhook formats, signature methods).
  - Implement comprehensive error handling and logging.

- **Webhook Security:**
  - Always verify webhook signatures in production.
  - Use HTTPS for webhook endpoints.
  - Rate limit webhook endpoints to prevent abuse.
  - Log all webhook attempts (successful and failed).

- **Notifications:**
  - For MVP, start with in-app notifications only, add email/SMS incrementally.
  - Use email templates for consistent branding.
  - SMS messages should be concise (160 characters or less).
  - Support multi-language notifications (use tenant's preferred language).

- **Export Formats:**
  - CSV should be UTF-8 encoded for proper character support.
  - PDF should include organization branding if available.
  - Both formats should include metadata (generation date, period, organization info).

- **Error Handling:**
  - All external API calls (payment providers, email, SMS) should have retry logic.
  - Log all failures for monitoring and debugging.
  - Provide user-friendly error messages.

---

## Dependencies to Install

- Payment provider SDKs (as available):
  - Telebirr SDK (if available).
  - CBE Birr SDK (if available).
  - Chapa SDK: `npm install chapa` (if available).
  - HelloCash SDK (if available).
- Email provider:
  - `npm install @sendgrid/mail` (for SendGrid) or similar.
- SMS provider:
  - Provider-specific SDK (e.g., Ethio Telecom SMS gateway SDK).
- CSV export:
  - `npm install csv-writer` or `papaparse`.
- PDF export:
  - `npm install puppeteer` or `@react-pdf/renderer` or `pdfkit`.
- Event handling (optional):
  - `npm install eventemitter3` or use native EventEmitter.

---

## Environment Variables to Add

```env
# Payment Providers
TELEBIRR_API_KEY=
TELEBIRR_API_SECRET=
TELEBIRR_BASE_URL=
TELEBIRR_WEBHOOK_SECRET=

CBE_BIRR_API_KEY=
CBE_BIRR_API_SECRET=
CBE_BIRR_BASE_URL=
CBE_BIRR_WEBHOOK_SECRET=

CHAPA_API_KEY=
CHAPA_API_SECRET=
CHAPA_BASE_URL=
CHAPA_WEBHOOK_SECRET=

HELLOCASH_API_KEY=
HELLOCASH_API_SECRET=
HELLOCASH_BASE_URL=
HELLOCASH_WEBHOOK_SECRET=

# Email Provider
EMAIL_PROVIDER=sendgrid
EMAIL_API_KEY=
EMAIL_FROM_ADDRESS=noreply@yourbms.com
EMAIL_FROM_NAME=BMS System

# SMS Provider
SMS_PROVIDER=
SMS_API_KEY=
SMS_API_SECRET=
SMS_SENDER_ID=
```
