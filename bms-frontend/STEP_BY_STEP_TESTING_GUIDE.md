# 🧪 BMS - Step-by-Step Testing Guide

## Test Each Feature One by One

---

## 📋 Prerequisites Check

Before we start testing, let's make sure everything is set up:

### Step 0: Environment Setup

1. **Check MongoDB is running:**

   ```bash
   # If using Docker Compose
   cd /home/blih/BMS
   docker compose ps

   # Or check if MongoDB is accessible
   docker ps | grep mongo
   ```

2. **Check environment variables:**

   ```bash
   cd /home/blih/BMS/bms-frontend
   # Check if .env.local exists (or create it)
   cat .env.local 2>/dev/null || echo "Need to create .env.local"
   ```

3. **Install dependencies (if needed):**

   ```bash
   cd /home/blih/BMS/bms-frontend
   npm install
   ```

4. **Start the development server:**

   ```bash
   npm run dev
   ```

5. **Verify health check:**
   - Open browser: `http://localhost:3000/api/health`
   - Should see: `{"status":"ok"}`

---

## 🎯 Testing Plan - One Feature at a Time

We'll test each module step by step. **Complete one section before moving to the next.**

---

## 📍 STEP 1: Homepage & Landing Page

### What to Test:

- Landing page loads correctly
- Navigation works
- All sections are visible

### Steps:

1. Open browser: `http://localhost:3000`
2. **Check:**
   - ✅ Hero section with "Manage Your Buildings Smarter"
   - ✅ Features section (6 feature cards)
   - ✅ Pricing section (3 plans)
   - ✅ Footer with links
3. **Test Navigation:**
   - Click "Login" button → Should go to `/login`
   - Click "Sign Up" button → Should go to `/tenant/signup`
   - Click "Staff Login" → Should go to `/login`

### Expected Result:

- Page loads without errors
- All sections visible
- Navigation works

**✅ Mark as complete when done, then proceed to Step 2**

---

## 📍 STEP 2: Authentication - Staff Login

### What to Test:

- Staff can log in with email/phone and password
- Error handling works
- Redirect after login works

### Steps:

1. Go to: `http://localhost:3000/login`
2. **Check the login form:**
   - ✅ Email/Phone input field
   - ✅ Password input field
   - ✅ "Forgot password?" link
   - ✅ "Sign In" button
   - ✅ Link to Tenant Portal

3. **Test with invalid credentials:**
   - Enter: `test@example.com` / `wrongpassword`
   - Click "Sign In"
   - ✅ Should show error message

4. **Test with valid credentials (if you have a test user):**
   - If no test user exists, we'll create one in the next step
   - Try logging in with known credentials

### Expected Result:

- Login page loads
- Form validation works
- Error messages display correctly

**✅ Mark as complete when done, then proceed to Step 2.5**

---

## 📍 STEP 2.5: Role-Based Login Redirects

### What to Test:

- Each role redirects to the correct dashboard after login
- SUPER_ADMIN → `/admin`
- ORG_ADMIN → `/org`
- BUILDING_MANAGER → `/org`
- Other staff roles → `/org`
- TENANT → `/tenant/dashboard` (via tenant login)

### Prerequisites:

Make sure test accounts are seeded. Run:

```bash
cd /home/blih/BMS/bms-frontend
# Seed all test accounts
curl -X POST http://localhost:3000/api/auth/seed-super-admin
curl -X POST http://localhost:3000/api/auth/seed-org-admin
curl -X POST http://localhost:3000/api/auth/seed-building-manager
```

### Test Accounts:

1. **SUPER_ADMIN**
   - Email: `superadmin@example.com`
   - Phone: `+19999999999`
   - Password: `SuperAdmin123!`
   - Expected Redirect: `/admin`

2. **ORG_ADMIN**
   - Email: `admin@example.com`
   - Phone: `+10000000000`
   - Password: `ChangeMe123!`
   - Expected Redirect: `/org`

3. **BUILDING_MANAGER**
   - Email: `building.manager@example.com`
   - Phone: `+10000000001`
   - Password: `BuildingManager123!`
   - Expected Redirect: `/org`

### Steps:

#### Test 1: SUPER_ADMIN Redirect

1. Go to: `http://localhost:3000/login`
2. Enter credentials:
   - Email/Phone: `superadmin@example.com`
   - Password: `SuperAdmin123!`
3. Click "Sign In"
4. **Verify:**
   - ✅ Should redirect to `http://localhost:3000/admin`
   - ✅ Should see "Admin Dashboard" page
   - ✅ Should see organizations, buildings, users stats

#### Test 2: ORG_ADMIN Redirect

1. Logout (if logged in)
2. Go to: `http://localhost:3000/login`
3. Enter credentials:
   - Email/Phone: `admin@example.com`
   - Password: `ChangeMe123!`
4. Click "Sign In"
5. **Verify:**
   - ✅ Should redirect to `http://localhost:3000/org`
   - ✅ Should see "Organization Dashboard" page
   - ✅ Should see buildings, units, tenants stats

#### Test 3: BUILDING_MANAGER Redirect

1. Logout (if logged in)
2. Go to: `http://localhost:3000/login`
3. Enter credentials:
   - Email/Phone: `building.manager@example.com`
   - Password: `BuildingManager123!`
4. Click "Sign In"
5. **Verify:**
   - ✅ Should redirect to `http://localhost:3000/org`
   - ✅ Should see "Organization Dashboard" page
   - ✅ Should see organization-scoped data

#### Test 4: Explicit Redirect Parameter

1. Go to: `http://localhost:3000/login?redirect=/admin/buildings`
2. Login with any staff account
3. **Verify:**
   - ✅ Should redirect to `/admin/buildings` (respects explicit redirect)
   - ✅ Not overridden by role-based redirect

### Expected Results:

- ✅ SUPER_ADMIN always redirects to `/admin` (unless explicit redirect)
- ✅ ORG_ADMIN redirects to `/org`
- ✅ BUILDING_MANAGER redirects to `/org`
- ✅ Other staff roles (FACILITY_MANAGER, ACCOUNTANT, etc.) redirect to `/org`
- ✅ Explicit `redirect` query parameter is respected
- ✅ No errors in browser console

### Troubleshooting:

- If redirect doesn't work, check browser console for errors
- Verify `/api/me` endpoint returns correct roles
- Check that session cookie is set after login
- Verify routes `/admin` and `/org` exist and are accessible

**✅ Mark as complete when all role redirects work correctly, then proceed to Step 3**

---

## 📍 STEP 3: Create Test Users & Organization

### What to Test:

- Create an organization
- Create admin user
- Set up initial data

### Steps:

#### Option A: Using API (Recommended for testing)

1. **Create Organization:**

   ```bash
   curl -X POST http://localhost:3000/api/organizations \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Test Property Management",
       "code": "TEST-PM",
       "contactInfo": {
         "email": "admin@testpm.com",
         "phone": "+251911234567"
       }
     }'
   ```

   - Note the `_id` from response (we'll need it)

2. **Create Admin User:**
   ```bash
   curl -X POST http://localhost:3000/api/users \
     -H "Content-Type: application/json" \
     -d '{
       "email": "admin@testpm.com",
       "phone": "+251911234567",
       "password": "Admin123!",
       "roles": ["ORG_ADMIN"],
       "organizationId": "YOUR_ORG_ID_HERE"
     }'
   ```

#### Option B: Using UI (if available)

1. Check if there's a signup/admin creation page
2. Fill in organization details
3. Create admin user

### Expected Result:

- Organization created successfully
- Admin user created
- Can log in with created credentials

**✅ Mark as complete when done, then proceed to Step 4**

---

## 📍 STEP 4: Admin Dashboard

### What to Test:

- Dashboard loads after login
- Stats cards display
- Navigation works

### Steps:

1. **Login as admin:**
   - Go to `/login`
   - Use credentials from Step 3
   - Should redirect to `/admin` or `/org`

2. **Check Dashboard:**
   - ✅ Stats cards visible (Organizations, Buildings, Tenants, etc.)
   - ✅ Charts load (if data exists)
   - ✅ Tables show data (if exists)
   - ✅ Navigation menu/sidebar visible

3. **Test Navigation:**
   - Click different menu items
   - Check if pages load correctly

### Expected Result:

- Dashboard displays correctly
- All widgets load
- Navigation works

**✅ Mark as complete when done, then proceed to Step 5**

---

## 📍 STEP 5: Building Management

### What to Test:

- Create a building
- View building details
- Edit building
- List all buildings

### Steps:

1. **Navigate to Buildings:**
   - Go to `/admin/buildings` or `/org/buildings`
   - Should see buildings list (may be empty)

2. **Create a New Building:**
   - Click "Add Building" or "New Building"
   - Fill in:
     - Name: "Test Building 1"
     - Address: "Addis Ababa, Ethiopia"
     - Type: "Residential" or "Commercial"
     - Number of floors: 5
     - Number of units: 10
   - Click "Save" or "Create"

3. **Verify Building Created:**
   - ✅ Building appears in list
   - ✅ Can click to view details
   - ✅ Can edit building
   - ✅ Can delete building (if allowed)

4. **Test Building Details Page:**
   - Click on building name
   - ✅ See building information
   - ✅ See related units (if any)
   - ✅ See related tenants (if any)

### Expected Result:

- Can create buildings
- Can view building details
- Can edit buildings
- List updates correctly

**✅ Mark as complete when done, then proceed to Step 6**

---

## 📍 STEP 6: Unit Management

### What to Test:

- Create units for a building
- View unit details
- Edit units
- Link units to building

### Steps:

1. **Navigate to Units:**
   - Go to `/admin/units` or `/org/units`
   - Or from building details page

2. **Create a New Unit:**
   - Click "Add Unit" or "New Unit"
   - Fill in:
     - Building: Select building from Step 5
     - Unit Number: "101"
     - Floor: 1
     - Type: "Apartment" or "Office"
     - Area (sq ft): 500
     - Rent Amount: 5000
   - Click "Save"

3. **Create More Units:**
   - Create 2-3 more units (102, 103, etc.)
   - Different floors and types

4. **Verify Units:**
   - ✅ Units appear in list
   - ✅ Filtered by building
   - ✅ Can view unit details
   - ✅ Can edit unit
   - ✅ Shows in building details page

### Expected Result:

- Can create units
- Units linked to buildings
- Can view and edit units

**✅ Mark as complete when done, then proceed to Step 7**

---

## 📍 STEP 7: Tenant Management

### What to Test:

- Create tenant
- View tenant details
- Edit tenant information
- Tenant profile management

### Steps:

1. **Navigate to Tenants:**
   - Go to `/admin/tenants` or `/org/tenants`

2. **Create a New Tenant:**
   - Click "Add Tenant" or "New Tenant"
   - Fill in:
     - Name: "John Doe"
     - Email: "john@example.com"
     - Phone: "+251912345678"
     - National ID: "1234567890"
     - Preferred Language: "English"
     - Address: "Addis Ababa"
   - Click "Save"

3. **Create More Tenants:**
   - Create 2-3 more tenants with different details

4. **Verify Tenants:**
   - ✅ Tenants appear in list
   - ✅ Can search/filter tenants
   - ✅ Can view tenant details
   - ✅ Can edit tenant
   - ✅ Can see tenant's leases (if any)

### Expected Result:

- Can create tenants
- Tenant information stored correctly
- Can view and edit tenants

**✅ Mark as complete when done, then proceed to Step 8**

---

## 📍 STEP 8: Lease Management

### What to Test:

- Create lease linking tenant to unit
- Set lease terms (rent, dates, charges)
- View lease details
- Lease status management

### Steps:

1. **Navigate to Leases:**
   - Go to `/admin/leases` or `/org/leases`

2. **Create a New Lease:**
   - Click "Add Lease" or "New Lease"
   - Fill in:
     - Tenant: Select tenant from Step 7
     - Unit: Select unit from Step 6
     - Start Date: Today or future date
     - End Date: 1 year from start
     - Monthly Rent: 5000
     - Service Charge: 500
     - Deposit: 10000
     - Billing Cycle: "Monthly"
   - Click "Save"

3. **Verify Lease:**
   - ✅ Lease appears in list
   - ✅ Status shows as "active"
   - ✅ Can view lease details
   - ✅ Shows tenant and unit information
   - ✅ Can edit lease
   - ✅ Can terminate lease

4. **Check Lease Details:**
   - Click on lease
   - ✅ See all lease information
   - ✅ See related invoices (if any)
   - ✅ See payment history (if any)

### Expected Result:

- Can create leases
- Leases link tenant to unit
- Lease information displays correctly

**✅ Mark as complete when done, then proceed to Step 9**

---

## 📍 STEP 9: Invoice Generation

### What to Test:

- Automatic invoice generation from leases
- Manual invoice creation
- Invoice details and status
- Invoice PDF generation

### Steps:

1. **Check Automatic Invoice Generation:**
   - If you created a lease with start date = today, invoices should be generated
   - Go to `/org/invoices` or `/admin/invoices`
   - ✅ Should see invoices for active leases

2. **Create Manual Invoice:**
   - Click "Create Invoice" or "New Invoice"
   - Fill in:
     - Tenant: Select tenant
     - Lease: Select lease (or leave blank for ad-hoc)
     - Invoice Type: "Rent" or "Service Charge"
     - Amount: 5000
     - Due Date: 7 days from today
     - Description: "Monthly rent"
   - Click "Save"

3. **Verify Invoice:**
   - ✅ Invoice appears in list
   - ✅ Status shows as "pending" or "unpaid"
   - ✅ Can view invoice details
   - ✅ Can download PDF (if available)
   - ✅ Shows tenant information
   - ✅ Shows amount and due date

4. **Test Invoice Details:**
   - Click on invoice
   - ✅ See all invoice information
   - ✅ See payment history (if any)
   - ✅ Can mark as paid (if manual payment)

### Expected Result:

- Invoices generated automatically
- Can create manual invoices
- Invoice details display correctly
- PDF generation works (if implemented)

**✅ Mark as complete when done, then proceed to Step 10**

---

## 📍 STEP 10: Payment Processing

### What to Test:

- Initiate payment
- Payment methods (Telebirr, CBE Birr, Chapa, HelloCash)
- Payment status tracking
- Payment reconciliation

### Steps:

1. **Navigate to Payments:**
   - Go to `/org/payments` or from invoice details
   - Or tenant portal: `/tenant/payments`

2. **Initiate Payment (from Invoice):**
   - Go to invoice details
   - Click "Pay Now" or "Make Payment"
   - Select payment method:
     - Telebirr
     - CBE Birr
     - Chapa
     - HelloCash
   - Enter amount (or use full amount)
   - Click "Proceed to Payment"

3. **Test Payment Flow:**
   - ✅ Payment intent created
   - ✅ Redirects to payment provider (or shows mock flow)
   - ✅ Payment status updates
   - ✅ Invoice status updates to "paid"

4. **Manual Payment Entry:**
   - Go to payments page
   - Click "Record Payment"
   - Fill in:
     - Invoice: Select invoice
     - Amount: 5000
     - Payment Method: "Bank Transfer" or "Cash"
     - Reference Number: "REF123"
     - Date: Today
   - Click "Save"

5. **Verify Payment:**
   - ✅ Payment appears in list
   - ✅ Shows in invoice payment history
   - ✅ Tenant balance updates
   - ✅ Receipt generated (if available)

### Expected Result:

- Can initiate payments
- Payment methods work (or show mock flow)
- Payment status tracked correctly
- Invoice updates after payment

**✅ Mark as complete when done, then proceed to Step 11**

---

## 📍 STEP 11: Tenant Portal - Login

### What to Test:

- Tenant OTP login
- Tenant dashboard access
- Tenant navigation

### Steps:

1. **Go to Tenant Login:**
   - Navigate to `/tenant/login`
   - Or click "Tenant Portal" from main page

2. **Test OTP Login Flow:**
   - Enter phone number: `+251912345678` (use tenant phone from Step 7)
   - Click "Send Code"
   - ✅ OTP code sent (check console/logs for code in dev mode)
   - Enter OTP code
   - Click "Verify"

3. **Verify Login:**
   - ✅ Redirects to tenant dashboard
   - ✅ Shows tenant information
   - ✅ Navigation menu visible

4. **Check Tenant Dashboard:**
   - ✅ Current balance displayed
   - ✅ Next payment due date
   - ✅ Recent invoices
   - ✅ Recent payments
   - ✅ Quick actions visible

### Expected Result:

- Tenant can log in with OTP
- Dashboard loads correctly
- Tenant sees their information only

**✅ Mark as complete when done, then proceed to Step 12**

---

## 📍 STEP 12: Tenant Portal - View Invoices & Payments

### What to Test:

- Tenant can view their invoices
- Tenant can view payment history
- Tenant can download receipts

### Steps:

1. **View Invoices:**
   - From tenant dashboard, click "Invoices" or go to `/tenant/invoices`
   - ✅ See list of invoices
   - ✅ See invoice status (paid/unpaid)
   - ✅ See amounts and due dates
   - Click on an invoice
   - ✅ See invoice details
   - ✅ Can download PDF (if available)

2. **View Payments:**
   - Click "Payments" or go to `/tenant/payments`
   - ✅ See payment history
   - ✅ See payment amounts
   - ✅ See payment dates
   - ✅ See payment methods
   - Click on a payment
   - ✅ See payment details
   - ✅ Can download receipt (if available)

3. **Test Filters:**
   - Filter by date range
   - Filter by status
   - Search invoices/payments

### Expected Result:

- Tenant can view all their invoices
- Tenant can view payment history
- Receipts/downloads work

**✅ Mark as complete when done, then proceed to Step 13**

---

## 📍 STEP 13: Tenant Portal - Make Payment

### What to Test:

- Tenant can pay invoices
- Payment methods work
- Payment confirmation

### Steps:

1. **From Invoice Page:**
   - Go to unpaid invoice
   - Click "Pay Now" or "Make Payment"
   - ✅ Payment form appears

2. **Select Payment Method:**
   - Choose: Telebirr, CBE Birr, Chapa, or HelloCash
   - Enter amount (or use full amount)
   - Click "Proceed"

3. **Complete Payment:**
   - Follow payment flow (mock or real)
   - ✅ Payment processed
   - ✅ Status updates
   - ✅ Receipt generated
   - ✅ Invoice marked as paid

4. **Verify Payment:**
   - Go back to invoices
   - ✅ Invoice status changed to "paid"
   - ✅ Balance updated
   - ✅ Payment appears in payment history

### Expected Result:

- Tenant can pay invoices
- Payment flow works
- Status updates correctly

**✅ Mark as complete when done, then proceed to Step 14**

---

## 📍 STEP 14: Complaints Management

### What to Test:

- Tenant can submit complaints
- Staff can view and manage complaints
- Complaint status updates
- Notifications sent

### Steps:

1. **Tenant Submits Complaint:**
   - Login as tenant
   - Go to `/tenant/complaints` or "Complaints" menu
   - Click "New Complaint" or "Submit Complaint"
   - Fill in:
     - Category: "Maintenance" or "Other"
     - Title: "Leaky faucet in kitchen"
     - Description: "The faucet in the kitchen is leaking"
     - Unit: Select unit (if multiple)
     - Priority: "Medium"
   - Upload photo (if available)
   - Click "Submit"

2. **Verify Complaint Created:**
   - ✅ Complaint appears in list
   - ✅ Status: "pending" or "open"
   - ✅ Can view complaint details

3. **Staff Views Complaint:**
   - Login as admin/building manager
   - Go to `/org/complaints` or complaints page
   - ✅ See tenant's complaint
   - ✅ See complaint details
   - ✅ See photos (if uploaded)

4. **Update Complaint Status:**
   - Click on complaint
   - Change status: "In Progress" or "Resolved"
   - Add comment: "Technician assigned"
   - Click "Update"

5. **Verify Notification:**
   - Tenant should receive notification (check tenant portal)
   - ✅ Complaint status updated
   - ✅ Notification visible

### Expected Result:

- Tenants can submit complaints
- Staff can view and manage complaints
- Status updates work
- Notifications sent

**✅ Mark as complete when done, then proceed to Step 15**

---

## 📍 STEP 15: Work Orders

### What to Test:

- Create work order from complaint
- Assign work order to technician
- Update work order status
- Technician can view assigned work orders

### Steps:

1. **Create Work Order from Complaint:**
   - From complaint details (Step 14)
   - Click "Create Work Order" or "Convert to Work Order"
   - Fill in:
     - Title: "Fix leaky faucet"
     - Priority: "Medium"
     - Assigned To: Select technician (or create one)
     - Due Date: 2 days from now
     - Description: "Fix kitchen faucet leak"
   - Click "Create"

2. **Verify Work Order:**
   - ✅ Work order created
   - ✅ Linked to complaint
   - ✅ Status: "open" or "assigned"
   - ✅ Technician notified (if notification works)

3. **Technician Views Work Order:**
   - Login as technician (or use technician portal)
   - Go to `/technician` or work orders page
   - ✅ See assigned work order
   - ✅ See work order details
   - ✅ See related complaint

4. **Update Work Order:**
   - Technician clicks on work order
   - Change status: "In Progress"
   - Add notes: "Started work, need parts"
   - Upload photo (if available)
   - Click "Update"

5. **Complete Work Order:**
   - Change status: "Completed"
   - Add notes: "Fixed successfully"
   - Click "Update"
   - ✅ Work order marked as completed
   - ✅ Complaint can be marked as resolved

### Expected Result:

- Can create work orders
- Can assign to technicians
- Technicians can update status
- Status tracking works

**✅ Mark as complete when done, then proceed to Step 16**

---

## 📍 STEP 16: Utilities & Meter Readings

### What to Test:

- Register meters
- Enter meter readings
- View consumption
- Generate alerts

### Steps:

1. **Register Meter:**
   - Login as admin/facility manager
   - Go to `/org/meters` or meters page
   - Click "Add Meter" or "New Meter"
   - Fill in:
     - Building: Select building
     - Unit: Select unit (or building-level)
     - Meter Type: "Electricity" or "Water"
     - Meter Number: "ELEC-001"
     - Location: "Unit 101"
   - Click "Save"

2. **Enter Meter Reading:**
   - Click on meter or go to readings
   - Click "Add Reading" or "New Reading"
   - Fill in:
     - Reading Value: 1000
     - Reading Date: Today
     - Source: "Manual"
   - Click "Save"

3. **Enter Another Reading:**
   - Wait a moment, then add another reading:
     - Reading Value: 1050
     - Reading Date: Today + 1 month
   - ✅ Consumption calculated: 50 units

4. **View Consumption:**
   - Go to meter details
   - ✅ See reading history
   - ✅ See consumption chart (if available)
   - ✅ See consumption trends

5. **Test Alerts:**
   - Set threshold: 100 units/month
   - Enter reading above threshold
   - ✅ Alert generated (if implemented)

### Expected Result:

- Can register meters
- Can enter readings
- Consumption calculated correctly
- Charts/trends display

**✅ Mark as complete when done, then proceed to Step 17**

---

## 📍 STEP 17: Reports & Analytics

### What to Test:

- Generate financial reports
- Generate operational reports
- Export reports (PDF/CSV)
- View analytics dashboards

### Steps:

1. **Financial Reports:**
   - Go to `/org/reports` or reports page
   - Click "Financial Reports"
   - Select report type:
     - Revenue Report
     - Arrears Report
     - Payment Report
   - Select date range
   - Click "Generate"

2. **Verify Report:**
   - ✅ Report displays
   - ✅ Shows correct data
   - ✅ Can export as PDF
   - ✅ Can export as CSV

3. **Operational Reports:**
   - Select "Occupancy Report"
   - Select date range
   - Click "Generate"
   - ✅ Shows occupancy rates
   - ✅ Shows vacancy rates

4. **Analytics Dashboard:**
   - Go to dashboard
   - ✅ Revenue charts
   - ✅ Occupancy trends
   - ✅ Payment trends
   - ✅ Complaint resolution times

### Expected Result:

- Reports generate correctly
- Data is accurate
- Exports work
- Charts display

**✅ Mark as complete when done, then proceed to Step 18**

---

## 📍 STEP 18: Notifications

### What to Test:

- In-app notifications
- Email notifications (if configured)
- SMS/WhatsApp notifications (if configured)
- Notification preferences

### Steps:

1. **Trigger Notification:**
   - Create an invoice (Step 9)
   - ✅ Notification created for tenant
   - ✅ Notification appears in tenant portal

2. **View Notifications:**
   - Login as tenant
   - Look for notification bell/icon
   - Click to view notifications
   - ✅ See invoice notification
   - ✅ Can mark as read

3. **Test Different Notifications:**
   - Payment received → Notification sent
   - Complaint status changed → Notification sent
   - Work order assigned → Notification sent
   - Lease expiring → Notification sent

4. **Check Notification Preferences:**
   - Go to profile/settings
   - ✅ Can set notification preferences
   - ✅ Can choose channels (email, SMS, in-app)
   - ✅ Can set quiet hours

### Expected Result:

- Notifications created for events
- Notifications display correctly
- Can mark as read
- Preferences work

**✅ Mark as complete when done, then proceed to Step 19**

---

## 📍 STEP 19: Security & Visitor Management

### What to Test:

- Register visitors
- Log visitor entry/exit
- View visitor history
- Generate visitor reports

### Steps:

1. **Register Visitor:**
   - Login as security guard/admin
   - Go to `/security/visitors` or visitors page
   - Click "Register Visitor" or "New Visitor"
   - Fill in:
     - Name: "Jane Smith"
     - Phone: "+251987654321"
     - Host: Select tenant
     - Purpose: "Meeting"
     - Vehicle: "ABC-123" (optional)
   - Click "Save"

2. **Log Entry:**
   - From visitor list, click "Log Entry"
   - ✅ Entry time recorded
   - ✅ Status: "In Building"

3. **Log Exit:**
   - After some time, click "Log Exit"
   - ✅ Exit time recorded
   - ✅ Status: "Exited"
   - ✅ Duration calculated

4. **View Visitor History:**
   - Go to visitor logs
   - ✅ See all visitors
   - ✅ Filter by date
   - ✅ Filter by tenant
   - ✅ See entry/exit times

5. **Generate Report:**
   - Click "Generate Report"
   - Select date range
   - ✅ Report shows visitor statistics

### Expected Result:

- Can register visitors
- Entry/exit logging works
- History displays correctly
- Reports generate

**✅ Mark as complete when done, then proceed to Step 20**

---

## 📍 STEP 20: Parking Management

### What to Test:

- Configure parking spaces
- Assign parking to tenants
- Register vehicles
- Track parking usage

### Steps:

1. **Configure Parking Spaces:**
   - Go to `/org/parking` or parking page
   - Click "Add Parking Space"
   - Fill in:
     - Building: Select building
     - Space Number: "P-001"
     - Type: "Tenant" or "Visitor"
     - Location: "Ground Floor"
   - Click "Save"

2. **Register Tenant Vehicle:**
   - Go to tenant details or vehicles page
   - Click "Add Vehicle"
   - Fill in:
     - Tenant: Select tenant
     - Plate Number: "ABC-123"
     - Make: "Toyota"
     - Model: "Corolla"
     - Color: "White"
   - Click "Save"

3. **Assign Parking:**
   - Go to parking spaces
   - Click on parking space
   - Assign to tenant/vehicle
   - ✅ Parking space marked as occupied

4. **View Parking Status:**
   - ✅ See available spaces
   - ✅ See occupied spaces
   - ✅ See tenant assignments

### Expected Result:

- Can configure parking spaces
- Can register vehicles
- Can assign parking
- Status tracking works

**✅ Mark as complete when done**

---

## 🎉 Testing Complete!

You've tested all major features!

### Next Steps:

1. **Review any issues found**
2. **Test edge cases**
3. **Test with multiple users/roles**
4. **Test on mobile devices**
5. **Performance testing**

---

## 📝 Notes Section

Use this space to note any issues or observations:

### Issues Found:

- [ ] Issue 1: Description
- [ ] Issue 2: Description

### Observations:

- Observation 1
- Observation 2

### Suggestions:

- Suggestion 1
- Suggestion 2

---

## 🔄 Quick Test Checklist

Use this for quick re-testing:

- [ ] Homepage loads
- [ ] Staff login works
- [ ] Admin dashboard loads
- [ ] Can create building
- [ ] Can create unit
- [ ] Can create tenant
- [ ] Can create lease
- [ ] Invoices generated
- [ ] Payments work
- [ ] Tenant login works
- [ ] Tenant can view invoices
- [ ] Tenant can pay
- [ ] Complaints work
- [ ] Work orders work
- [ ] Meters work
- [ ] Reports work
- [ ] Notifications work
- [ ] Visitors work
- [ ] Parking works

---

**Happy Testing! 🚀**
