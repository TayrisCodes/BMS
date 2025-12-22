---
name: Financial & Accounting Module
overview: ""
todos: []
---

# Financial & Accounting Module Implementation Plan

## Overview

This plan implements a complete financial and accounting system for the BMS platform, building on existing invoice and payment infrastructure. The implementation includes automated billing, local payment integrations, payment processing, financial reporting, and compliance features.

## Current State Analysis

**Already Implemented:**

- Invoice model and CRUD operations (`src/lib/invoices/invoices.ts`)
- Recurring invoice generation from leases (`src/modules/leases/invoicing-service.ts`)
- Payment providers (Telebirr, CBE Birr, Chapa, HelloCash) (`src/modules/payments/providers/`)
- Payment webhook handlers (`app/api/webhooks/payments/[provider]/route.ts`)
- Payment intent service (`src/modules/payments/payment-intent-service.ts`)
- Basic financial reports (`app/api/reports/financial/route.ts`)
- Cron jobs for monthly invoicing (`app/api/cron/monthly-invoices/route.ts`)
- Parking invoices (ad-hoc) (`src/lib/invoices/invoices.ts`)

**Gaps to Address:**

1. Ad-hoc invoices for maintenance and penalties (parking exists)
2. Invoice templates and customization
3. Enhanced payment reminders
4. Detailed aging reports (0-30, 31-60, 61-90, 90+ days)
5. Revenue trends and forecasting
6. ERCA-compliant export formats
7. Digital receipt generation (PDF)
8. Multi-currency support (ETB primary, USD optional)

## Implementation Tasks

### 1. Enhanced Automated Billing

**1.1 Ad-Hoc Invoice Creation**

- File: `src/lib/invoices/invoices.ts`
- Add `createAdHocInvoice` function supporting:
- Maintenance invoices (linked to work orders)
- Penalty invoices (linked to leases or invoices)
- Other ad-hoc charges
- Support invoice types: `rent`, `maintenance`, `penalty`, `parking`, `other`
- API: `app/api/invoices/ad-hoc/route.ts` (POST)

**1.2 Invoice Templates**

- File: `src/lib/invoices/templates.ts`
- Create template system:
- Template model with fields: name, organizationId, items, defaultVAT, customFields
- CRUD operations for templates
- Apply template when creating invoices
- API: `app/api/invoices/templates/route.ts` (GET, POST, PUT, DELETE)
- UI: `app/org/invoices/templates/page.tsx` (template management)

**1.3 Enhanced Payment Reminders**

- File: `src/modules/notifications/payment-reminders.ts`
- Enhance existing reminder system:
- Configurable reminder schedule (e.g., 7 days before, 3 days before, on due date, 3 days after)
- Multi-channel reminders (in-app, email, SMS)
- Escalation for overdue invoices
- Update: `app/api/cron/payment-due-reminders/route.ts`

### 2. Payment Processing Enhancements

**2.1 Digital Receipt Generation**

- File: `src/lib/pdf/PaymentReceiptPdf.tsx`
- Create PDF receipt component using `@react-pdf/renderer`
- Include: payment details, invoice reference, transaction ID, date, amount, payment method
- API: `app/api/payments/[id]/receipt/route.ts` (GET - stream PDF)
- Auto-generate receipt URL on payment completion
- Update: `src/lib/payments/payments.ts` to generate receipt URL

**2.2 Payment Reconciliation Improvements**

- File: `app/api/webhooks/payments/[provider]/route.ts`
- Enhance webhook handler:
- Better idempotency checks (reference number uniqueness)
- Retry mechanism for failed webhooks
- Webhook signature verification for all providers
- Detailed logging and audit trail
- File: `app/api/payments/[id]/reconcile/route.ts`
- Manual reconciliation endpoint for bank transfers

**2.3 Payment Status Tracking**

- Enhance payment model to track:
- Payment lifecycle states
- Provider transaction IDs
- Reconciliation status
- Failure reasons
- Update: `src/lib/payments/payments.ts`

### 3. Financial Reporting

**3.1 Aging Reports**

- File: `src/modules/reports/aging-report.ts`
- Calculate aging buckets:
- Current (0-30 days)
- 31-60 days
- 61-90 days
- 90+ days
- Group by tenant, building, or portfolio
- API: `app/api/reports/aging/route.ts` (GET)
- UI: `app/org/reports/aging/page.tsx`

**3.2 Revenue Trends and Forecasting**

- File: `src/modules/reports/revenue-forecast.ts`
- Calculate:
- Monthly/quarterly revenue trends
- Year-over-year comparisons
- Forecast based on historical data and active leases
- Revenue by building/portfolio
- API: `app/api/reports/revenue-trends/route.ts` (GET)
- Enhance: `app/api/reports/financial/route.ts` to include forecast data

**3.3 Enhanced Financial Reports**

- Enhance existing financial reports:
- Income and expense breakdown
- Building-level summaries
- Portfolio-level aggregations
- Payment method analytics
- Update: `app/api/reports/financial/route.ts`
- Update: `app/org/reports/financial/page.tsx`

### 4. ERCA Compliance

**4.1 ERCA Export Format**

- File: `src/modules/reports/erca-export.ts`
- Create ERCA-compliant export:
- Invoice data format matching ERCA requirements
- VAT breakdown and reporting
- Transaction summaries
- Date range exports
- API: `app/api/reports/erca/export/route.ts` (GET - CSV/PDF)
- Support both CSV and PDF formats

**4.2 ERCA Report Generation**

- File: `app/api/reports/erca/route.ts`
- Generate ERCA-compliant reports:
- Monthly/quarterly tax reports
- VAT summary reports
- Transaction listings
- UI: `app/org/reports/erca/page.tsx`

### 5. Multi-Currency Support

**5.1 Currency Configuration**

- File: `src/lib/currencies/currencies.ts`
- Currency model:
- Code (ETB, USD)
- Symbol
- Exchange rate (for USD)
- Primary currency flag
- Store exchange rates with timestamps
- API: `app/api/settings/currencies/route.ts` (GET, POST, PUT)

**5.2 Invoice Currency Support**

- Update: `src/lib/invoices/invoices.ts`
- Add `currency` field to Invoice model (default: ETB)
- Convert amounts when displaying in different currencies
- Update invoice creation to support currency selection

**5.3 Payment Currency Support**

- Update: `src/lib/payments/payments.ts`
- Add `currency` and `exchangeRate` fields
- Handle currency conversion for payments
- Display amounts in tenant's preferred currency

### 6. Data Model Updates

**6.1 Invoice Model Enhancements**

- File: `src/lib/invoices/invoic