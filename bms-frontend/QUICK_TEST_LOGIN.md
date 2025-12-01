# 🚀 Quick Test Login - Copy & Paste

## ✅ All Test Accounts Ready!

---

## 1️⃣ SUPER_ADMIN (Platform Admin)

**Login:** `http://localhost:3000/login`

```
Email:    superadmin@example.com
Phone:    +19999999999
Password: SuperAdmin123!
```

**What you can do:**

- Manage all organizations
- Create new organizations
- Manage users across all organizations
- View system-wide analytics

---

## 2️⃣ ORG_ADMIN (Organization Admin)

**Login:** `http://localhost:3000/login`

```
Email:    admin@example.com
Phone:    +10000000000
Password: ChangeMe123!
```

**What you can do:**

- Manage buildings and units
- Manage tenants and leases
- Create invoices
- View financial reports
- Manage staff users

---

## 3️⃣ BUILDING_MANAGER

**Login:** `http://localhost:3000/login`

```
Email:    building.manager@example.com
Phone:    +10000000001
Password: BuildingManager123!
```

**What you can do:**

- Manage units in assigned building
- Manage tenants
- Handle complaints
- View building reports

---

## 4️⃣ TENANT (Tenant Portal)

**Login:** `http://localhost:3000/tenant/login`

```
Phone:    +251912345678
Method:   OTP (One-Time Password)
```

**Steps:**

1. Enter phone: `+251912345678`
2. Click "Send Code"
3. Check terminal/console for OTP code (in dev mode)
4. Enter OTP code
5. Access tenant dashboard

**What you can do:**

- View invoices
- Make payments
- Submit complaints
- View lease details
- Manage visitor QR codes

---

## 🎯 Quick Test Flow

### Test 1: SUPER_ADMIN Login

1. Go to: `http://localhost:3000/login`
2. Enter: `superadmin@example.com`
3. Password: `SuperAdmin123!`
4. ✅ Should see admin dashboard

### Test 2: ORG_ADMIN Login

1. Go to: `http://localhost:3000/login`
2. Enter: `admin@example.com`
3. Password: `ChangeMe123!`
4. ✅ Should see organization dashboard

### Test 3: Tenant OTP Login

1. Go to: `http://localhost:3000/tenant/login`
2. Enter: `+251912345678`
3. Click "Send Code"
4. Check console for OTP
5. Enter OTP
6. ✅ Should see tenant dashboard

---

## 📝 Notes

- All accounts are **active** and ready to use
- Passwords are **case-sensitive**
- Tenant uses **OTP**, not password
- In development, OTP codes are **logged to console**
- Organization ID: `691a22668c1bf2fe5b178577`

---

## 🔄 Re-seed Accounts

If you need to reset accounts:

```bash
cd /home/blih/BMS/bms-frontend
./seed-test-accounts.sh
```

---

**Ready to test! Start with Step 1 in the testing guide.** 🎉
