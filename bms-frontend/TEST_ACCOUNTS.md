# 🔐 BMS Test Accounts

## Quick Seed Script

Run this command to create all test accounts:

```bash
cd /home/blih/BMS/bms-frontend
chmod +x seed-test-accounts.sh
./seed-test-accounts.sh
```

Or use curl commands directly:

```bash
# Seed Organization
curl -X POST http://localhost:3000/api/organizations/seed

# Seed SUPER_ADMIN
curl -X POST http://localhost:3000/api/auth/seed-super-admin

# Seed ORG_ADMIN
curl -X POST http://localhost:3000/api/auth/seed-org-admin

# Seed BUILDING_MANAGER
curl -X POST http://localhost:3000/api/auth/seed-building-manager

# Seed Tenant
curl -X POST http://localhost:3000/api/seed-tenant
```

---

## 📋 Test Accounts

### 1. SUPER_ADMIN (Platform Administrator)

**Role:** Platform-level admin, can manage all organizations

- **Email:** `superadmin@example.com`
- **Phone:** `+19999999999`
- **Password:** `SuperAdmin123!`
- **Login URL:** `http://localhost:3000/login`
- **Access:**
  - Can create/manage organizations
  - Can see all organizations
  - Can manage all users across organizations
  - Full system access

---

### 2. ORG_ADMIN (Organization Administrator)

**Role:** Organization-level admin, manages one organization

- **Email:** `admin@example.com`
- **Phone:** `+10000000000`
- **Password:** `ChangeMe123!`
- **Login URL:** `http://localhost:3000/login`
- **Access:**
  - Can manage buildings, units, tenants
  - Can manage staff users in their organization
  - Can view financial reports
  - Full access within their organization

---

### 3. BUILDING_MANAGER

**Role:** Manages a specific building

- **Email:** `building.manager@example.com`
- **Phone:** `+10000000001`
- **Password:** `BuildingManager123!`
- **Login URL:** `http://localhost:3000/login`
- **Access:**
  - Can manage units in assigned building
  - Can manage tenants
  - Can view building-level reports
  - Can manage complaints and work orders

---

### 4. TENANT (Tenant Portal User)

**Role:** Tenant user, self-service portal

- **Phone:** `+251912345678`
- **Login URL:** `http://localhost:3000/tenant/login`
- **Login Method:** OTP (One-Time Password)
- **Access:**
  - View invoices and payments
  - Make payments
  - Submit complaints
  - View lease details
  - Manage visitor QR codes

**Note:** Tenant uses OTP login, not password. Enter phone number and receive OTP code.

---

## 🧪 Testing Workflow

### Step 1: Seed All Accounts

```bash
./seed-test-accounts.sh
```

### Step 2: Test SUPER_ADMIN Login

1. Go to: `http://localhost:3000/login`
2. Enter: `superadmin@example.com` or `+19999999999`
3. Password: `SuperAdmin123!`
4. Should redirect to admin dashboard

### Step 3: Test ORG_ADMIN Login

1. Go to: `http://localhost:3000/login`
2. Enter: `admin@example.com` or `+10000000000`
3. Password: `ChangeMe123!`
4. Should redirect to organization dashboard

### Step 4: Test Tenant OTP Login

1. Go to: `http://localhost:3000/tenant/login`
2. Enter phone: `+251912345678`
3. Click "Send Code"
4. Check console/logs for OTP code (in dev mode)
5. Enter OTP code
6. Should redirect to tenant dashboard

---

## 🔄 Resetting Test Data

If you need to reset test accounts, you can:

1. **Delete users from MongoDB:**

   ```bash
   # Connect to MongoDB
   docker exec -it bms-mongo mongosh -u bms_root -p bms_password --authenticationDatabase admin

   # Switch to database
   use bms

   # Delete test users (be careful!)
   db.users.deleteMany({ email: { $in: ["superadmin@example.com", "admin@example.com", "building.manager@example.com"] } })
   ```

2. **Re-run seed script:**
   ```bash
   ./seed-test-accounts.sh
   ```

---

## 📝 Custom Test Accounts

You can create custom test accounts by setting environment variables:

```bash
# For SUPER_ADMIN
export INIT_SUPER_ADMIN_EMAIL="your-email@example.com"
export INIT_SUPER_ADMIN_PHONE="+251911111111"
export INIT_SUPER_ADMIN_PASSWORD="YourPassword123!"

# For ORG_ADMIN
export INIT_ORG_ADMIN_EMAIL="org-admin@example.com"
export INIT_ORG_ADMIN_PHONE="+251922222222"
export INIT_ORG_ADMIN_PASSWORD="OrgAdmin123!"

# For Organization
export INIT_ORG_ID="my-org"
export INIT_ORG_NAME="My Organization"
export INIT_ORG_EMAIL="org@example.com"
export INIT_ORG_PHONE="+251933333333"

# Then run seed endpoints
```

---

## ⚠️ Important Notes

1. **Production Safety:** Seed endpoints are disabled in production mode
2. **Password Security:** Change default passwords in production
3. **Organization ID:** SUPER_ADMIN uses `"system"` as organizationId
4. **Tenant OTP:** In development, OTP codes are logged to console
5. **Database:** Make sure MongoDB is running before seeding

---

## 🎯 Quick Test Checklist

- [ ] Run seed script
- [ ] Test SUPER_ADMIN login
- [ ] Test ORG_ADMIN login
- [ ] Test BUILDING_MANAGER login
- [ ] Test Tenant OTP login
- [ ] Verify each user sees correct dashboard
- [ ] Test role-based access restrictions

---

**Happy Testing! 🚀**
