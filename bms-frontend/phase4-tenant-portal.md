## Phase 4 – Tenant Portal (Web/PWA) (Detailed Plan)

### Goals

- Complete tenant-facing mobile-first UI for dashboard, invoices, payments, complaints, and lease details.
- Implement payment initiation system with provider abstraction (Telebirr, CBE Birr, Chapa, HelloCash).
- Complete complaints submission and tracking functionality.
- Add multi-language support (Amharic, English, Afaan Oromo, Tigrigna) with user preferences.
- Add Progressive Web App (PWA) support for installability and offline capability.

### Current State Analysis

**✅ Already Implemented:**

- Tenant authentication: OTP-based login (`app/tenant/login/page.tsx`, `/api/auth/request-otp`, `/api/auth/verify-otp`).
- Tenant layout: `TenantMobileLayout` with bottom navigation (`app/tenant/layout.tsx`).
- Tenant dashboard: Mobile-first UI with balance, next invoice, quick actions (`app/tenant/dashboard/page.tsx`).
- Tenant APIs: `/api/tenant/dashboard`, `/api/tenant/invoices`, `/api/tenant/payments`, `/api/tenant/complaints`, `/api/tenant/lease`.
- Mobile components: `MobileCard`, `MobileList`, `SwipeableCard`, `MobileForm`, `BottomSheet`.
- Tenant routes: dashboard, invoices, payments, complaints (list + new), lease, profile, login, signup.

**❌ Needs Implementation:**

- Payment initiation API with provider abstraction (payment intent pattern).
- Payment provider integrations (Telebirr, CBE Birr, Chapa, HelloCash) - MVP with mocks.
- Invoice detail page (`app/tenant/invoices/[id]/page.tsx`).
- Lease detail page completion (`app/tenant/lease/page.tsx`).
- Complaint detail/tracking page (`app/tenant/complaints/[id]/page.tsx`).
- Photo upload for complaints.
- Multi-language support (i18n integration).
- PWA manifest and service worker.
- Payment webhook handlers for provider callbacks.

---

### Step 1 – Complete Tenant Dashboard & API Integration

- **1.1 Verify and enhance tenant dashboard API**
  - **1.1.1** Review `app/api/tenant/dashboard/route.ts`:
    - Currently uses `userId` to find tenant (assumes `tenants` collection has `userId` field).
    - Update to use proper tenant lookup (may need to link `users` collection to `tenants` collection via phone or separate linking).
    - Ensure proper error handling and data validation.
  - **1.1.2** Fix tenant lookup logic:
    - If `tenants` collection stores `userId`, ensure it's properly linked.
    - If not, use phone number from user session to find tenant.
    - Update queries to use proper tenant `_id` from `tenants` collection.

- **1.2 Enhance dashboard UI**
  - **1.2.1** Update `app/tenant/dashboard/page.tsx`:
    - Add pull-to-refresh functionality (optional).
    - Add error state handling (show error message if API fails).
    - Add loading skeletons for better UX.
    - Ensure all data displays correctly with proper formatting.

---

### Step 2 – Invoice Detail Page

- **2.1 Create invoice detail API**
  - **2.1.1** Create `app/api/tenant/invoices/[id]/route.ts`:
    - `GET`: Fetch single invoice by ID.
    - Verify tenant owns the invoice (check `tenantId` matches session tenant).
    - Return invoice details: number, amount, due date, status, items breakdown, payment history.
    - Use `requireTenant()` guard from `@/lib/auth/guards`.

- **2.2 Create invoice detail UI**
  - **2.2.1** Create `app/tenant/invoices/[id]/page.tsx`:
    - Mobile-first design with large, readable text.
    - Display invoice header: number, issue date, due date, status badge.
    - Display items breakdown: description, amount, type (rent, charge, penalty).
    - Display totals: subtotal, tax (if any), total.
    - Display payment history (if any payments made).
    - "Pay Now" button (if unpaid).
    - "Download PDF" button (optional, for future).
    - Back button to invoices list.

---

### Step 3 – Payment Initiation System

- **3.1 Create payment intent abstraction**
  - **3.1.1** Create `src/modules/payments/payment-intent.ts`:
    - Define `PaymentIntent` interface:
      ```typescript
      interface PaymentIntent {
        id: string;
        invoiceId?: string;
        tenantId: string;
        organizationId: string;
        amount: number;
        currency: string; // "ETB"
        provider: 'telebirr' | 'cbe_birr' | 'chapa' | 'hellocash' | 'bank_transfer';
        status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
        providerMetadata?: Record<string, unknown>;
        redirectUrl?: string;
        createdAt: Date;
        expiresAt: Date;
      }
      ```
  - **3.1.2** Create `PaymentIntentService`:
    - `createPaymentIntent(input: CreatePaymentIntentInput)`: Create intent and return provider-specific redirect URL or payment instructions.
    - `getPaymentIntentStatus(intentId: string)`: Check status of payment intent.
    - `cancelPaymentIntent(intentId: string)`: Cancel pending intent.

- **3.2 Create payment provider abstraction**
  - **3.2.1** Create `src/modules/payments/providers/base.ts`:
    - Define `PaymentProvider` interface:
      ```typescript
      interface PaymentProvider {
        initiatePayment(intent: PaymentIntent): Promise<PaymentInitiationResult>;
        verifyPayment(reference: string): Promise<PaymentVerificationResult>;
        getProviderName(): string;
      }
      ```
  - **3.2.2** Create provider implementations:
    - `src/modules/payments/providers/telebirr.ts`: Telebirr provider (mock for MVP).
    - `src/modules/payments/providers/cbe-birr.ts`: CBE Birr provider (mock for MVP).
    - `src/modules/payments/providers/chapa.ts`: Chapa provider (mock for MVP).
    - `src/modules/payments/providers/hellocash.ts`: HelloCash provider (mock for MVP).
    - `src/modules/payments/providers/mock.ts`: Mock provider for development.

- **3.3 Mock provider implementation (MVP)**
  - **3.3.1** Create `src/modules/payments/providers/mock.ts`:
    - For development, simulate payment flow:
      - `initiatePayment()`: Returns mock redirect URL or payment instructions.
      - `verifyPayment()`: Simulates payment verification (always succeeds in dev).
    - Log all payment attempts for testing.

- **3.4 Payment intent API**
  - **3.4.1** Create `app/api/tenant/payments/intent/route.ts`:
    - `POST`: Create payment intent.
      - Request body: `{ invoiceId?: string, amount: number, provider: string }`.
      - Validate tenant owns invoice (if provided).
      - Create payment intent record.
      - Call provider's `initiatePayment()`.
      - Return: `{ intentId, redirectUrl?, paymentInstructions? }`.
    - `GET /api/tenant/payments/intent/[id]`: Get payment intent status.

- **3.5 Update payment UI**
  - **3.5.1** Update `app/tenant/payments/page.tsx`:
    - Replace TODO in `handlePaymentSubmit()` with actual payment intent creation.
    - Call `/api/tenant/payments/intent` to create intent.
    - If `redirectUrl` provided, redirect user to provider's payment page.
    - If `paymentInstructions` provided, display instructions to user.
    - Show loading state during payment initiation.
    - Handle errors gracefully.

- **3.6 Payment webhook handlers (for future)**
  - **3.6.1** Create `app/api/webhooks/payments/[provider]/route.ts`:
    - Handle provider callbacks (Telebirr, CBE Birr, Chapa, HelloCash).
    - Verify webhook signature (for security).
    - Update payment intent status.
    - Create payment record in `payments` collection.
    - Update invoice status to "paid" if payment successful.
    - Send notification to tenant.
  - **3.6.2** For MVP, use polling or manual verification (webhooks can be added later).

---

### Step 4 – Complete Complaints Functionality

- **4.1 Verify complaints API**
  - **4.1.1** Review `app/api/tenant/complaints/route.ts`:
    - Ensure `POST` handler creates complaint with proper tenant scoping.
    - Ensure `GET` handler lists only tenant's own complaints.
    - Add photo upload support (store photo URLs in complaint document).

- **4.2 Add photo upload**
  - **4.2.1** Create `app/api/tenant/complaints/upload/route.ts`:
    - `POST`: Handle photo upload (multipart/form-data).
    - Store photos in cloud storage or local file system (for MVP, use local storage or base64).
    - Return photo URLs.
    - Validate file type and size (images only, max 5MB per file).
  - **4.2.2** Update complaint form:
    - Add photo upload UI in `app/tenant/complaints/new/page.tsx`.
    - Allow multiple photos (up to 5).
    - Show preview of uploaded photos.
    - Upload photos before submitting complaint, include URLs in complaint data.

- **4.3 Create complaint detail/tracking page**
  - **4.3.1** Create `app/api/tenant/complaints/[id]/route.ts`:
    - `GET`: Fetch single complaint by ID.
    - Verify tenant owns the complaint.
    - Return complaint details: category, title, description, photos, status, assignedTo, resolution notes, timestamps.
  - **4.3.2** Create `app/tenant/complaints/[id]/page.tsx`:
    - Display complaint details.
    - Show status timeline (open → assigned → in_progress → resolved).
    - Display photos in gallery.
    - Show resolution notes (if resolved).
    - Back button to complaints list.

- **4.4 Update complaints list page**
  - **4.4.1** Review `app/tenant/complaints/page.tsx`:
    - Ensure it displays all tenant complaints.
    - Add filter by status (open, assigned, in_progress, resolved).
    - Add tap-to-view-detail functionality.
    - Show status badges and priority indicators.

---

### Step 5 – Complete Lease Details Page

- **5.1 Verify lease API**
  - **5.1.1** Review `app/api/tenant/lease/route.ts`:
    - Ensure it returns current active lease for tenant.
    - Return lease details: unit info, rent amount, billing cycle, due day, additional charges, dates, status.

- **5.2 Complete lease UI**
  - **5.2.1** Review/update `app/tenant/lease/page.tsx`:
    - Display lease information in mobile-friendly format.
    - Sections: Lease Info, Unit Info, Terms, Charges.
    - Use collapsible sections for better mobile UX.
    - Show lease dates (start, end, or "Month-to-month").
    - Display rent amount and billing cycle.
    - List additional charges if any.
    - Show lease status and expiration info.

---

### Step 6 – Multi-Language Support (i18n)

- **6.1 Choose i18n solution**
  - **6.1.1** Install `next-intl` (recommended) or create custom i18n solution:
    - `npm install next-intl`
    - Follow Next.js App Router integration guide.

- **6.2 Set up i18n configuration**
  - **6.2.1** Create `src/i18n/config.ts`:
    - Configure supported locales: `["am", "en", "om", "ti"]` (Amharic, English, Afaan Oromo, Tigrigna).
    - Set default locale: `"en"`.
    - Configure locale detection (from user preference, browser, or default).

- **6.3 Create translation files**
  - **6.3.1** Create translation files structure:
    - `src/messages/en.json` (English - base).
    - `src/messages/am.json` (Amharic).
    - `src/messages/om.json` (Afaan Oromo).
    - `src/messages/ti.json` (Tigrigna).
  - **6.3.2** Extract all UI strings from tenant portal:
    - Dashboard: "Current Balance", "Pay Now", "Next Payment Due", etc.
    - Invoices: "Invoice", "Due Date", "Status", etc.
    - Payments: "Make Payment", "Payment Method", etc.
    - Complaints: "Submit Complaint", "Category", "Description", etc.
    - Common: "Loading...", "Error", "Back", "Save", "Cancel", etc.

- **6.4 Integrate i18n in tenant portal**
  - **6.4.1** Update `app/tenant/layout.tsx`:
    - Wrap with `NextIntlClientProvider` or custom i18n provider.
    - Read locale from user preference (stored in tenant/user record).
  - **6.4.2** Update all tenant pages:
    - Replace hardcoded strings with `t()` or `useTranslations()` calls.
    - Use translation keys like `t("dashboard.balance")`, `t("invoices.title")`, etc.

- **6.5 Language switcher**
  - **6.5.1** Add language switcher to `TenantMobileLayout`:
    - Dropdown or button in header/topbar.
    - Allow tenant to change language preference.
    - Save preference to tenant/user record.
    - Persist in session/cookie.

- **6.6 User language preference**
  - **6.6.1** Update tenant/user model:
    - Ensure `language` field exists (already in `Tenant` interface as `language?: string | null`).
    - Default to tenant's preferred language from database.
  - **6.6.2** Create API endpoint: `PATCH /api/tenant/profile`:
    - Update tenant's language preference.
    - Return updated tenant data.

---

### Step 7 – Progressive Web App (PWA) Support

- **7.1 Create PWA manifest**
  - **7.1.1** Create `public/manifest.json`:
    - App name, short name, description.
    - Icons (multiple sizes: 192x192, 512x512 for Android; 180x180 for iOS).
    - Theme color, background color.
    - Display mode: `"standalone"` or `"fullscreen"`.
    - Start URL: `"/tenant/dashboard"`.
    - Scope: `"/tenant"`.

- **7.2 Add PWA meta tags**
  - **7.2.1** Update `app/layout.tsx` or create tenant-specific layout:
    - Add `<link rel="manifest" href="/manifest.json" />`.
    - Add Apple touch icon meta tags.
    - Add theme color meta tags.
    - Add viewport meta tag with PWA-friendly settings.

- **7.3 Create service worker (optional for MVP)**
  - **7.3.1** Create `public/sw.js` or use Next.js PWA plugin:
    - Cache static assets (CSS, JS, images).
    - Cache API responses (with expiration).
    - Offline fallback page.
    - Background sync for complaints/payments (queue actions when offline).
  - **7.3.2** Register service worker:
    - In `app/tenant/layout.tsx` or client component.
    - Check for service worker support.
    - Register on page load.

- **7.4 Install prompt**
  - **7.4.1** Add install prompt UI (optional):
    - Detect if app is installable (`beforeinstallprompt` event).
    - Show banner/button to install app.
    - Handle install flow.

---

### Step 8 – Profile & Settings Page

- **8.1 Complete profile API**
  - **8.1.1** Create `app/api/tenant/profile/route.ts`:
    - `GET`: Return tenant profile data (name, phone, email, language preference).
    - `PATCH`: Update tenant profile (name, email, language).
    - Verify tenant owns the profile.

- **8.2 Complete profile UI**
  - **8.2.1** Review/update `app/tenant/profile/page.tsx`:
    - Display tenant info: name, phone, email.
    - Editable fields: name, email, language preference.
    - Language switcher (if not in layout).
    - Change password section (if password auth is added for tenants).
    - Logout button.
    - Mobile-friendly form with proper validation.

---

### Step 9 – Error Handling & Loading States

- **9.1 Add error boundaries**
  - **9.1.1** Create `src/components/tenant/ErrorBoundary.tsx`:
    - Catch React errors in tenant portal.
    - Display user-friendly error message.
    - Option to retry or go back.

- **9.2 Improve loading states**
  - **9.2.1** Add loading skeletons:
    - For dashboard cards.
    - For invoice/payment lists.
    - For complaint forms.
  - **9.2.2** Use React Suspense where appropriate:
    - For data fetching in server components.

- **9.3 Offline handling**
  - **9.3.1** Add offline detection:
    - Show banner when offline.
    - Queue actions (complaints, payments) when offline.
    - Sync when connection restored (via service worker or manual retry).

---

### Step 10 – Testing & Polish

- **10.1 Test payment flow**
  - **10.1.1** Test payment intent creation:
    - With invoice ID.
    - Without invoice ID (manual payment).
    - Different payment providers (all should work with mocks).
  - **10.1.2** Test payment status checking:
    - Poll for payment status.
    - Handle success/failure states.

- **10.2 Test complaints flow**
  - **10.2.1** Test complaint submission:
    - With photos.
    - Without photos.
    - Different categories.
  - **10.2.2** Test complaint tracking:
    - View complaint details.
    - See status updates.

- **10.3 Test i18n**
  - **10.3.1** Test language switching:
    - Switch between all 4 languages.
    - Verify all strings are translated.
    - Test RTL support for Amharic (if needed).

- **10.4 Test PWA**
  - **10.4.1** Test installability:
    - Install on Android device.
    - Install on iOS device (Safari).
    - Test offline functionality (if service worker implemented).

- **10.5 Mobile responsiveness**
  - **10.5.1** Test on various screen sizes:
    - Small phones (320px).
    - Large phones (428px).
    - Tablets (768px+).
  - **10.5.2** Test touch interactions:
    - Swipe gestures.
    - Tap targets (min 44x44px).
    - Form inputs (keyboard-friendly).

---

### Step 11 – Phase 4 Exit Criteria

- **11.1 Tenant Dashboard**
  - ✅ Tenant can view current balance, next due date, quick stats.
  - ✅ Dashboard displays recent invoices and quick actions.
  - ✅ All data loads correctly with proper error handling.

- **11.2 Invoices**
  - ✅ Tenant can view list of invoices with filters.
  - ✅ Tenant can view invoice details.
  - ✅ Invoice status and payment history are displayed correctly.

- **11.3 Payments**
  - ✅ Tenant can initiate payment via multiple providers (Telebirr, CBE Birr, Chapa, HelloCash).
  - ✅ Payment intent system works with provider abstraction.
  - ✅ Payment history is displayed correctly.
  - ✅ Mock providers work in development.

- **11.4 Complaints**
  - ✅ Tenant can submit complaints with photos.
  - ✅ Tenant can view complaint list and details.
  - ✅ Tenant can track complaint status.

- **11.5 Lease**
  - ✅ Tenant can view lease details in mobile-friendly format.

- **11.6 Multi-Language**
  - ✅ Tenant can switch between Amharic, English, Afaan Oromo, Tigrigna.
  - ✅ All UI strings are translated.
  - ✅ Language preference is saved and persisted.

- **11.7 PWA**
  - ✅ App is installable as PWA.
  - ✅ Manifest is configured correctly.
  - ✅ Basic offline support (optional for MVP).

- **11.8 Mobile UX**
  - ✅ All pages are mobile-first and touch-friendly.
  - ✅ Swipe gestures work where implemented.
  - ✅ Forms are keyboard-friendly.

---

## Implementation Notes

- **Payment Provider Integration:**
  - For MVP, use mock providers that simulate payment flow.
  - Design provider interface to easily plug in real providers later.
  - Real provider integration will require:
    - API keys/secrets (store in environment variables).
    - Webhook endpoints for callbacks.
    - Signature verification for webhooks.
    - Idempotency handling.

- **Photo Upload:**
  - For MVP, use local storage or base64 encoding.
  - For production, integrate with cloud storage (AWS S3, Cloudinary, etc.).
  - Validate file types (images only: jpg, png, webp).
  - Limit file size (max 5MB per file, max 5 files per complaint).

- **i18n:**
  - Start with English as base, add other languages incrementally.
  - Use translation keys that are descriptive (e.g., `dashboard.balance.title` not `t1`).
  - Consider RTL support for Amharic (may need additional CSS).

- **PWA:**
  - Service worker is optional for MVP (can be added later).
  - Focus on manifest and installability first.
  - Test on real devices (Android and iOS).

- **Error Handling:**
  - Always show user-friendly error messages.
  - Log errors server-side for debugging.
  - Provide retry mechanisms where appropriate.

- **Performance:**
  - Lazy load images.
  - Optimize API calls (use React Query or SWR for caching).
  - Minimize bundle size (code splitting).

---

## Dependencies to Install

- `next-intl` (for i18n support).
- Image upload library (optional, for photo handling): `react-dropzone` or similar.
- PWA plugin (optional): `next-pwa` or manual service worker.
- Payment provider SDKs (for future real integrations):
  - Telebirr SDK (when available).
  - CBE Birr SDK (when available).
  - Chapa SDK (when available).
  - HelloCash SDK (when available).

