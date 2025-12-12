#!/usr/bin/env tsx
/**
 * Complete data seeding script for MongoDB Atlas
 * Creates tenant, building, units, lease, and integrates with org admin and building manager
 * Usage: MONGODB_URI="your-connection-string" tsx scripts/seed-complete-data.ts
 * 
 * REQUIRED: MONGODB_URI environment variable must be set
 */

import { MongoClient, ObjectId, Db } from 'mongodb';
import bcrypt from 'bcryptjs';

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ Error: MONGODB_URI environment variable is required');
  console.error('Usage: MONGODB_URI="your-connection-string" tsx scripts/seed-complete-data.ts');
  process.exit(1);
}

// Environment variables with defaults
const INIT_ORG_ID = process.env.INIT_ORG_ID || 'dev-org-1';
const INIT_ORG_ADMIN_EMAIL = process.env.INIT_ORG_ADMIN_EMAIL || 'admin@example.com';
const INIT_BUILDING_MANAGER_EMAIL =
  process.env.INIT_BUILDING_MANAGER_EMAIL || 'building.manager@example.com';
const INIT_TENANT_PHONE = process.env.INIT_TENANT_PHONE || '+251912345678';
const INIT_TENANT_EMAIL = process.env.INIT_TENANT_EMAIL || 'tenant@example.com';
const INIT_TENANT_FIRST_NAME = process.env.INIT_TENANT_FIRST_NAME || 'John';
const INIT_TENANT_LAST_NAME = process.env.INIT_TENANT_LAST_NAME || 'Doe';

interface Organization {
  _id: ObjectId;
  name: string;
  code: string;
  contactInfo?: {
    email?: string;
    phone?: string;
    address?: string;
  } | null;
  settings?: {
    [key: string]: unknown;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

interface User {
  _id: ObjectId;
  organizationId: string;
  email: string | null;
  phone: string;
  passwordHash: string;
  roles: string[];
  status: 'active' | 'invited' | 'suspended';
  createdAt: Date;
  updatedAt: Date;
}

interface Tenant {
  _id: ObjectId;
  organizationId: string;
  firstName: string;
  lastName: string;
  primaryPhone: string;
  email?: string | null;
  nationalId?: string | null;
  language: string;
  status: 'active' | 'inactive' | 'suspended';
  emergencyContact?: {
    name: string;
    phone: string;
  } | null;
  notes?: string | null;
  notificationPreferences?: {
    emailEnabled: boolean;
    smsEnabled: boolean;
    inAppEnabled: boolean;
    emailTypes: string[];
    smsTypes: string[];
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

interface Building {
  _id: ObjectId;
  organizationId: string;
  name: string;
  address?: {
    street?: string;
    city?: string;
    region?: string;
    postalCode?: string;
  } | null;
  buildingType: 'residential' | 'commercial' | 'mixed';
  totalFloors?: number | null;
  totalUnits?: number | null;
  status: 'active' | 'under-construction' | 'inactive';
  managerId?: string | null;
  settings?: {
    parkingSpaces?: number;
    amenities?: string[];
    [key: string]: unknown;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

interface Unit {
  _id: ObjectId;
  organizationId: string;
  buildingId: string;
  unitNumber: string;
  floor?: number | null;
  unitType: 'apartment' | 'office' | 'shop' | 'warehouse' | 'parking';
  area?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  status: 'available' | 'occupied' | 'maintenance' | 'reserved';
  rentAmount?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

interface Lease {
  _id: ObjectId;
  organizationId: string;
  tenantId: string;
  unitId: string;
  startDate: Date;
  endDate?: Date | null;
  rentAmount: number;
  depositAmount?: number | null;
  billingCycle: 'monthly' | 'quarterly' | 'annually';
  dueDay: number;
  additionalCharges?: Array<{
    name: string;
    amount: number;
    frequency: 'monthly' | 'quarterly' | 'annually' | 'one-time';
  }> | null;
  status: 'active' | 'expired' | 'terminated' | 'pending';
  terminationDate?: Date | null;
  terminationReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

async function seedCompleteData() {
  console.log('🌱 Starting Complete Data Seeding for MongoDB Atlas...\n');

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB Atlas\n');

    const db = client.db();
    const organizationsCollection = db.collection<Organization>('organizations');
    const usersCollection = db.collection<User>('users');
    const tenantsCollection = db.collection<Tenant>('tenants');
    const buildingsCollection = db.collection<Building>('buildings');
    const unitsCollection = db.collection<Unit>('units');
    const leasesCollection = db.collection<Lease>('leases');

    const now = new Date();

    // Step 1: Get or create Organization
    console.log('📋 Step 1: Getting Organization...');
    let organization = await organizationsCollection.findOne({ code: INIT_ORG_ID });
    if (!organization) {
      const orgDoc: Omit<Organization, '_id'> = {
        name: 'Development Organization',
        code: INIT_ORG_ID,
        contactInfo: null,
        settings: null,
        createdAt: now,
        updatedAt: now,
      };
      const orgResult = await organizationsCollection.insertOne(orgDoc as any);
      organization = {
        _id: orgResult.insertedId,
        ...orgDoc,
      } as Organization;
      console.log(`✅ Organization created: ${organization.name}`);
    } else {
      console.log(`ℹ️  Organization found: ${organization.name}`);
    }
    const organizationId = organization._id.toString();
    console.log('');

    // Step 2: Get ORG_ADMIN and BUILDING_MANAGER
    console.log('📋 Step 2: Getting ORG_ADMIN and BUILDING_MANAGER...');
    let orgAdmin = await usersCollection.findOne({
      email: INIT_ORG_ADMIN_EMAIL,
    });
    if (!orgAdmin) {
      throw new Error(
        `ORG_ADMIN not found: ${INIT_ORG_ADMIN_EMAIL}. Please run seed-atlas.ts first.`,
      );
    }
    // Ensure user has ORG_ADMIN role and correct organizationId
    if (!orgAdmin.roles || !orgAdmin.roles.includes('ORG_ADMIN')) {
      await usersCollection.updateOne(
        { _id: orgAdmin._id },
        {
          $set: {
            roles: ['ORG_ADMIN'],
            organizationId,
            updatedAt: now,
          },
        },
      );
      orgAdmin = await usersCollection.findOne({ _id: orgAdmin._id });
      console.log(`⚠️  Updated user ${orgAdmin?.email} with ORG_ADMIN role`);
    }
    if (orgAdmin.organizationId !== organizationId) {
      await usersCollection.updateOne(
        { _id: orgAdmin._id },
        { $set: { organizationId, updatedAt: now } },
      );
      orgAdmin = await usersCollection.findOne({ _id: orgAdmin._id });
    }
    console.log(`✅ ORG_ADMIN found: ${orgAdmin?.email} (org: ${orgAdmin?.organizationId})`);

    let buildingManager = await usersCollection.findOne({
      email: INIT_BUILDING_MANAGER_EMAIL,
    });
    if (!buildingManager) {
      throw new Error(
        `BUILDING_MANAGER not found: ${INIT_BUILDING_MANAGER_EMAIL}. Please run seed-atlas.ts first.`,
      );
    }
    // Ensure user has BUILDING_MANAGER role and correct organizationId
    if (!buildingManager.roles || !buildingManager.roles.includes('BUILDING_MANAGER')) {
      await usersCollection.updateOne(
        { _id: buildingManager._id },
        {
          $set: {
            roles: ['BUILDING_MANAGER'],
            organizationId,
            updatedAt: now,
          },
        },
      );
      buildingManager = await usersCollection.findOne({ _id: buildingManager._id });
      console.log(`⚠️  Updated user ${buildingManager?.email} with BUILDING_MANAGER role`);
    }
    if (buildingManager.organizationId !== organizationId) {
      await usersCollection.updateOne(
        { _id: buildingManager._id },
        { $set: { organizationId, updatedAt: now } },
      );
      buildingManager = await usersCollection.findOne({ _id: buildingManager._id });
    }
    console.log(
      `✅ BUILDING_MANAGER found: ${buildingManager?.email} (org: ${buildingManager?.organizationId})`,
    );
    const buildingManagerId = buildingManager!._id.toString();
    console.log('');

    // Step 3: Create or update Tenant
    console.log('📋 Step 3: Creating/Updating Tenant...');
    let tenant = await tenantsCollection.findOne({
      organizationId,
      primaryPhone: INIT_TENANT_PHONE,
    });

    if (!tenant) {
      const tenantDoc: Omit<Tenant, '_id'> = {
        organizationId,
        firstName: INIT_TENANT_FIRST_NAME,
        lastName: INIT_TENANT_LAST_NAME,
        primaryPhone: INIT_TENANT_PHONE,
        email: INIT_TENANT_EMAIL,
        nationalId: null,
        language: 'en',
        status: 'active',
        emergencyContact: {
          name: 'Emergency Contact',
          phone: '+251911111111',
        },
        notes: 'Seeded tenant for testing',
        notificationPreferences: {
          emailEnabled: true,
          smsEnabled: true,
          inAppEnabled: true,
          emailTypes: ['invoice', 'payment', 'complaint', 'maintenance'],
          smsTypes: ['invoice', 'payment'],
        },
        createdAt: now,
        updatedAt: now,
      };
      const tenantResult = await tenantsCollection.insertOne(tenantDoc as any);
      tenant = {
        _id: tenantResult.insertedId,
        ...tenantDoc,
      } as Tenant;
      console.log(
        `✅ Tenant created: ${tenant.firstName} ${tenant.lastName} (${tenant.primaryPhone})`,
      );
    } else {
      // Update existing tenant with complete info
      await tenantsCollection.updateOne(
        { _id: tenant._id },
        {
          $set: {
            firstName: INIT_TENANT_FIRST_NAME,
            lastName: INIT_TENANT_LAST_NAME,
            email: INIT_TENANT_EMAIL,
            emergencyContact: {
              name: 'Emergency Contact',
              phone: '+251911111111',
            },
            notificationPreferences: {
              emailEnabled: true,
              smsEnabled: true,
              inAppEnabled: true,
              emailTypes: ['invoice', 'payment', 'complaint', 'maintenance'],
              smsTypes: ['invoice', 'payment'],
            },
            updatedAt: now,
          },
        },
      );
      tenant = await tenantsCollection.findOne({ _id: tenant._id });
      console.log(
        `✅ Tenant updated: ${tenant?.firstName} ${tenant?.lastName} (${tenant?.primaryPhone})`,
      );
    }
    const tenantId = tenant._id.toString();
    console.log('');

    // Step 4: Create Building
    console.log('📋 Step 4: Creating Building...');
    let building = await buildingsCollection.findOne({
      organizationId,
      name: 'Sample Residential Building',
    });

    if (!building) {
      const buildingDoc: Omit<Building, '_id'> = {
        organizationId,
        name: 'Sample Residential Building',
        address: {
          street: '123 Main Street',
          city: 'Addis Ababa',
          region: 'Addis Ababa',
          postalCode: '1000',
        },
        buildingType: 'residential',
        totalFloors: 5,
        totalUnits: 20,
        status: 'active',
        managerId: buildingManagerId,
        settings: {
          parkingSpaces: 25,
          amenities: ['Elevator', 'Security', 'Parking', 'Gym'],
        },
        createdAt: now,
        updatedAt: now,
      };
      const buildingResult = await buildingsCollection.insertOne(buildingDoc as any);
      building = {
        _id: buildingResult.insertedId,
        ...buildingDoc,
      } as Building;
      console.log(`✅ Building created: ${building.name}`);
    } else {
      // Update building to assign manager
      await buildingsCollection.updateOne(
        { _id: building._id },
        {
          $set: {
            managerId: buildingManagerId,
            updatedAt: now,
          },
        },
      );
      building = await buildingsCollection.findOne({ _id: building._id });
      console.log(`ℹ️  Building found: ${building?.name} (assigned to BUILDING_MANAGER)`);
    }
    const buildingId = building._id.toString();
    console.log('');

    // Step 5: Create Units
    console.log('📋 Step 5: Creating Units...');
    const unitsToCreate = [
      {
        unitNumber: 'A-101',
        floor: 1,
        unitType: 'apartment' as const,
        area: 80,
        bedrooms: 2,
        bathrooms: 1,
        rentAmount: 5000,
      },
      {
        unitNumber: 'A-102',
        floor: 1,
        unitType: 'apartment' as const,
        area: 80,
        bedrooms: 2,
        bathrooms: 1,
        rentAmount: 5000,
      },
      {
        unitNumber: 'A-201',
        floor: 2,
        unitType: 'apartment' as const,
        area: 100,
        bedrooms: 3,
        bathrooms: 2,
        rentAmount: 7000,
      },
      {
        unitNumber: 'A-202',
        floor: 2,
        unitType: 'apartment' as const,
        area: 100,
        bedrooms: 3,
        bathrooms: 2,
        rentAmount: 7000,
      },
      {
        unitNumber: 'A-301',
        floor: 3,
        unitType: 'apartment' as const,
        area: 120,
        bedrooms: 3,
        bathrooms: 2,
        rentAmount: 9000,
      },
    ];

    const createdUnits: Unit[] = [];
    for (const unitData of unitsToCreate) {
      let unit = await unitsCollection.findOne({
        buildingId,
        unitNumber: unitData.unitNumber,
      });

      if (!unit) {
        const unitDoc: Omit<Unit, '_id'> = {
          organizationId,
          buildingId,
          unitNumber: unitData.unitNumber,
          floor: unitData.floor,
          unitType: unitData.unitType,
          area: unitData.area,
          bedrooms: unitData.bedrooms,
          bathrooms: unitData.bathrooms,
          status: 'available',
          rentAmount: unitData.rentAmount,
          createdAt: now,
          updatedAt: now,
        };
        const unitResult = await unitsCollection.insertOne(unitDoc as any);
        unit = {
          _id: unitResult.insertedId,
          ...unitDoc,
        } as Unit;
        console.log(`  ✅ Unit created: ${unit.unitNumber} (${unit.unitType}, ${unit.area}m²)`);
      } else {
        console.log(`  ℹ️  Unit exists: ${unit.unitNumber}`);
      }
      createdUnits.push(unit);
    }
    console.log('');

    // Step 6: Create Lease for Tenant
    console.log('📋 Step 6: Creating Lease for Tenant...');
    // Use the first unit (A-101) for the lease
    const leaseUnit = createdUnits[0];

    // Check if tenant already has an active lease
    let lease = await leasesCollection.findOne({
      organizationId,
      tenantId,
      status: 'active',
    });

    if (!lease) {
      const leaseStartDate = new Date();
      leaseStartDate.setDate(1); // Start on 1st of current month
      const leaseEndDate = new Date(leaseStartDate);
      leaseEndDate.setFullYear(leaseEndDate.getFullYear() + 1); // 1 year lease

      const leaseDoc: Omit<Lease, '_id'> = {
        organizationId,
        tenantId,
        unitId: leaseUnit._id.toString(),
        startDate: leaseStartDate,
        endDate: leaseEndDate,
        rentAmount: leaseUnit.rentAmount || 5000,
        depositAmount: (leaseUnit.rentAmount || 5000) * 2, // 2 months deposit
        billingCycle: 'monthly',
        dueDay: 5, // Due on 5th of each month
        additionalCharges: [
          {
            name: 'Service Charge',
            amount: 500,
            frequency: 'monthly',
          },
          {
            name: 'Water',
            amount: 200,
            frequency: 'monthly',
          },
          {
            name: 'Electricity',
            amount: 300,
            frequency: 'monthly',
          },
        ],
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };
      const leaseResult = await leasesCollection.insertOne(leaseDoc as any);
      lease = {
        _id: leaseResult.insertedId,
        ...leaseDoc,
      } as Lease;
      console.log(
        `✅ Lease created: Unit ${leaseUnit.unitNumber}, Rent: ${lease.rentAmount} ETB/month`,
      );

      // Update unit status to occupied
      await unitsCollection.updateOne(
        { _id: leaseUnit._id },
        {
          $set: {
            status: 'occupied',
            updatedAt: now,
          },
        },
      );
      console.log(`  ✅ Unit ${leaseUnit.unitNumber} status updated to 'occupied'`);
    } else {
      console.log(`ℹ️  Active lease already exists for tenant`);
    }
    console.log('');

    // Summary
    console.log('====================================');
    console.log('✅ Complete Data Seeding Finished!');
    console.log('====================================\n');
    console.log('📋 Created/Updated Data:\n');
    console.log(`1. Organization: ${organization.name} (${organization.code})`);
    console.log(`2. ORG_ADMIN: ${orgAdmin.email}`);
    console.log(`3. BUILDING_MANAGER: ${buildingManager.email} (assigned to building)`);
    console.log(`4. Tenant: ${tenant?.firstName} ${tenant?.lastName}`);
    console.log(`   Phone: ${tenant?.primaryPhone}`);
    console.log(`   Email: ${tenant?.email}`);
    console.log(`5. Building: ${building?.name}`);
    console.log(`   Type: ${building?.buildingType}`);
    console.log(`   Floors: ${building?.totalFloors}`);
    console.log(`   Units: ${building?.totalUnits}`);
    console.log(`   Manager: ${buildingManager.email}`);
    console.log(`6. Units: ${createdUnits.length} units created`);
    createdUnits.forEach((unit) => {
      console.log(`   - ${unit.unitNumber}: ${unit.unitType}, ${unit.area}m², ${unit.status}`);
    });
    if (lease) {
      console.log(`7. Lease: Active lease for Unit ${leaseUnit.unitNumber}`);
      console.log(`   Rent: ${lease.rentAmount} ETB/month`);
      console.log(`   Deposit: ${lease.depositAmount} ETB`);
      console.log(`   Billing Cycle: ${lease.billingCycle}`);
      console.log(`   Due Day: ${lease.dueDay} of each month`);
      console.log(`   Additional Charges: ${lease.additionalCharges?.length || 0} charges`);
    }
    console.log('\n🔗 Integration Summary:');
    console.log(`   - Tenant is linked to Organization: ${organizationId}`);
    console.log(`   - Building is managed by: ${buildingManager.email} (BUILDING_MANAGER)`);
    console.log(`   - Building belongs to Organization: ${organization.name}`);
    console.log(`   - Lease connects Tenant to Unit ${leaseUnit.unitNumber}`);
    console.log(`   - ORG_ADMIN can manage all of the above`);
    console.log(`   - BUILDING_MANAGER can manage building, units, and leases`);
    console.log(`   - Tenant can view their lease, invoices, and make payments`);
    console.log('');
  } catch (error) {
    console.error('❌ Error seeding complete data:', error);
    throw error;
  } finally {
    await client.close();
    console.log('✅ Database connection closed');
  }
}

// Run the seed script
seedCompleteData()
  .then(() => {
    console.log('\n🎉 All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Seeding failed:', error);
    process.exit(1);
  });
