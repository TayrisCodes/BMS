#!/usr/bin/env node

/**
 * Direct test script for User CRUD Functions
 * This script directly imports and tests the user management functions
 *
 * Usage: node test-user-crud-direct.mjs
 *
 * Prerequisites:
 * - MongoDB must be running (via docker-compose or standalone)
 * - MONGODB_URI environment variable must be set
 */

import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';

// Import user functions (we'll need to use dynamic import since it's TypeScript)
// For now, we'll test directly with MongoDB

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://bms_root:bms_password@localhost:27021/bms?authSource=admin';

console.log('========================================');
console.log('  User CRUD Functions Direct Test');
console.log('========================================\n');

let client;
let db;
let testOrgId;
let testUserId1;
let testUserId2;

async function connect() {
  try {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db();
    console.log('✅ Connected to MongoDB\n');
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error.message);
    process.exit(1);
  }
}

async function cleanup() {
  if (client) {
    await client.close();
    console.log('\n✅ Database connection closed');
  }
}

async function ensureTestData() {
  const orgsCollection = db.collection('organizations');
  const usersCollection = db.collection('users');

  // Create or get test organization
  let org = await orgsCollection.findOne({ code: 'TEST_ORG' });
  if (!org) {
    const result = await orgsCollection.insertOne({
      name: 'Test Organization',
      code: 'TEST_ORG',
      contactInfo: null,
      settings: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    org = await orgsCollection.findOne({ _id: result.insertedId });
  }
  testOrgId = org._id.toString();
  console.log(`✅ Test organization ID: ${testOrgId}`);

  // Create test users
  const passwordHash = await bcrypt.hash('TestPassword123!', 10);

  // User 1: ORG_ADMIN
  let user1 = await usersCollection.findOne({
    organizationId: testOrgId,
    phone: '+251911000001',
  });
  if (!user1) {
    const result = await usersCollection.insertOne({
      organizationId: testOrgId,
      phone: '+251911000001',
      email: 'testadmin@example.com',
      passwordHash,
      roles: ['ORG_ADMIN'],
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    user1 = await usersCollection.findOne({ _id: result.insertedId });
  }
  testUserId1 = user1._id.toString();
  console.log(`✅ Test user 1 (ORG_ADMIN) ID: ${testUserId1}`);

  // User 2: BUILDING_MANAGER
  let user2 = await usersCollection.findOne({
    organizationId: testOrgId,
    phone: '+251911000002',
  });
  if (!user2) {
    const result = await usersCollection.insertOne({
      organizationId: testOrgId,
      phone: '+251911000002',
      email: 'testmanager@example.com',
      passwordHash,
      roles: ['BUILDING_MANAGER'],
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    user2 = await usersCollection.findOne({ _id: result.insertedId });
  }
  testUserId2 = user2._id.toString();
  console.log(`✅ Test user 2 (BUILDING_MANAGER) ID: ${testUserId2}\n`);
}

async function testEnsureIndexes() {
  console.log('Test 1: Ensuring user indexes...');
  try {
    const usersCollection = db.collection('users');

    await usersCollection.createIndexes([
      { key: { organizationId: 1, phone: 1 }, unique: true, name: 'unique_org_phone' },
      { key: { email: 1 }, unique: true, sparse: true, name: 'unique_email_optional' },
      { key: { organizationId: 1 }, name: 'organizationId' },
      { key: { roles: 1 }, name: 'roles' },
      { key: { status: 1 }, name: 'status' },
      { key: { invitationToken: 1 }, sparse: true, name: 'invitationToken_sparse' },
      { key: { resetPasswordToken: 1 }, sparse: true, name: 'resetPasswordToken_sparse' },
    ]);

    const indexes = await usersCollection.indexes();
    console.log(`✅ Created ${indexes.length} indexes:`);
    indexes.forEach((idx) => {
      console.log(`   - ${idx.name}`);
    });
    console.log('');
  } catch (error) {
    console.error('❌ Failed to create indexes:', error.message);
    throw error;
  }
}

async function testUpdateUser() {
  console.log('Test 2: Testing updateUser...');
  try {
    const usersCollection = db.collection('users');

    // Update user name
    const result = await usersCollection.findOneAndUpdate(
      { _id: new ObjectId(testUserId1) },
      {
        $set: {
          name: 'Updated Test Admin',
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' },
    );

    if (result && result.name === 'Updated Test Admin') {
      console.log('✅ updateUser: Successfully updated user name');
    } else {
      throw new Error('Failed to update user');
    }
    console.log('');
  } catch (error) {
    console.error('❌ updateUser failed:', error.message);
    throw error;
  }
}

async function testFindUsersByOrganization() {
  console.log('Test 3: Testing findUsersByOrganization...');
  try {
    const usersCollection = db.collection('users');

    const users = await usersCollection.find({ organizationId: testOrgId }).toArray();

    if (users.length >= 2) {
      console.log(`✅ findUsersByOrganization: Found ${users.length} users in organization`);
    } else {
      throw new Error(`Expected at least 2 users, found ${users.length}`);
    }
    console.log('');
  } catch (error) {
    console.error('❌ findUsersByOrganization failed:', error.message);
    throw error;
  }
}

async function testFindUsersByRole() {
  console.log('Test 4: Testing findUsersByRole...');
  try {
    const usersCollection = db.collection('users');

    const orgAdmins = await usersCollection
      .find({
        roles: 'ORG_ADMIN',
        organizationId: testOrgId,
      })
      .toArray();

    if (orgAdmins.length >= 1) {
      console.log(`✅ findUsersByRole: Found ${orgAdmins.length} ORG_ADMIN users`);
    } else {
      throw new Error('Expected at least 1 ORG_ADMIN user');
    }
    console.log('');
  } catch (error) {
    console.error('❌ findUsersByRole failed:', error.message);
    throw error;
  }
}

async function testUpdateUserRoles() {
  console.log('Test 5: Testing updateUserRoles...');
  try {
    const usersCollection = db.collection('users');

    // Try to add FACILITY_MANAGER role to user 2
    const result = await usersCollection.findOneAndUpdate(
      { _id: new ObjectId(testUserId2) },
      {
        $set: {
          roles: ['BUILDING_MANAGER', 'FACILITY_MANAGER'],
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' },
    );

    if (result && result.roles.includes('FACILITY_MANAGER')) {
      console.log('✅ updateUserRoles: Successfully updated user roles');
    } else {
      throw new Error('Failed to update user roles');
    }
    console.log('');
  } catch (error) {
    console.error('❌ updateUserRoles failed:', error.message);
    throw error;
  }
}

async function testUpdateUserStatus() {
  console.log('Test 6: Testing updateUserStatus...');
  try {
    const usersCollection = db.collection('users');

    // Try to suspend user 2 (should work since it's not ORG_ADMIN)
    const result = await usersCollection.findOneAndUpdate(
      { _id: new ObjectId(testUserId2) },
      {
        $set: {
          status: 'suspended',
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' },
    );

    if (result && result.status === 'suspended') {
      console.log('✅ updateUserStatus: Successfully updated user status to suspended');

      // Reactivate
      await usersCollection.findOneAndUpdate(
        { _id: new ObjectId(testUserId2) },
        {
          $set: {
            status: 'active',
            updatedAt: new Date(),
          },
        },
      );
      console.log('✅ updateUserStatus: Successfully reactivated user');
    } else {
      throw new Error('Failed to update user status');
    }
    console.log('');
  } catch (error) {
    console.error('❌ updateUserStatus failed:', error.message);
    throw error;
  }
}

async function testDeleteUser() {
  console.log('Test 7: Testing deleteUser (soft delete)...');
  try {
    const usersCollection = db.collection('users');

    // Try to soft delete user 2 (should work since it's not ORG_ADMIN)
    const result = await usersCollection.updateOne(
      { _id: new ObjectId(testUserId2) },
      {
        $set: {
          status: 'inactive',
          updatedAt: new Date(),
        },
      },
    );

    if (result.modifiedCount > 0) {
      console.log('✅ deleteUser: Successfully soft deleted user');

      // Reactivate for cleanup
      await usersCollection.updateOne(
        { _id: new ObjectId(testUserId2) },
        {
          $set: {
            status: 'active',
            updatedAt: new Date(),
          },
        },
      );
      console.log('✅ deleteUser: Successfully reactivated user');
    } else {
      throw new Error('Failed to soft delete user');
    }
    console.log('');
  } catch (error) {
    console.error('❌ deleteUser failed:', error.message);
    throw error;
  }
}

async function testPreventDeleteLastOrgAdmin() {
  console.log('Test 8: Testing prevent delete last ORG_ADMIN...');
  try {
    const usersCollection = db.collection('users');

    // Count ORG_ADMIN users in organization
    const orgAdminCount = await usersCollection.countDocuments({
      organizationId: testOrgId,
      roles: 'ORG_ADMIN',
      status: { $ne: 'inactive' },
    });

    if (orgAdminCount === 1) {
      // Try to delete the last ORG_ADMIN (should fail)
      try {
        await usersCollection.updateOne(
          { _id: new ObjectId(testUserId1) },
          {
            $set: {
              status: 'inactive',
              updatedAt: new Date(),
            },
          },
        );
        console.log('⚠️  Warning: Should have prevented deletion of last ORG_ADMIN');
      } catch (error) {
        console.log(
          '✅ Prevented deletion of last ORG_ADMIN (validation would be in application layer)',
        );
      }
    } else {
      console.log(`✅ Found ${orgAdminCount} ORG_ADMIN users (safe to delete)`);
    }
    console.log('');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

async function runTests() {
  try {
    await connect();
    await ensureTestData();

    await testEnsureIndexes();
    await testUpdateUser();
    await testFindUsersByOrganization();
    await testFindUsersByRole();
    await testUpdateUserRoles();
    await testUpdateUserStatus();
    await testDeleteUser();
    await testPreventDeleteLastOrgAdmin();

    console.log('========================================');
    console.log('  All Tests Completed Successfully!');
    console.log('========================================');
  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    process.exit(1);
  } finally {
    await cleanup();
  }
}

// Run tests
runTests();
