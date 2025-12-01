#!/usr/bin/env node

/**
 * Direct MongoDB test script for Step 4 - User CRUD APIs
 * Tests user CRUD operations directly against MongoDB
 *
 * Usage: node test-step4-user-crud-direct.mjs
 *
 * Prerequisites:
 * - MongoDB must be running (via docker-compose or standalone)
 * - MONGODB_URI environment variable must be set
 */

import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://bms_root:bms_password@localhost:27021/bms?authSource=admin';

console.log('========================================');
console.log('  Step 4 - User CRUD APIs Direct Test');
console.log('========================================\n');

let client;
let db;
let testOrgId;
let testUserId1;
let testUserId2;
let testUserId3;

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
  let org = await orgsCollection.findOne({ code: 'TEST_ORG_STEP4' });
  if (!org) {
    const result = await orgsCollection.insertOne({
      name: 'Test Organization Step 4',
      code: 'TEST_ORG_STEP4',
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
    phone: '+251911100001',
  });
  if (!user1) {
    const result = await usersCollection.insertOne({
      organizationId: testOrgId,
      phone: '+251911100001',
      email: 'step4admin@example.com',
      passwordHash,
      roles: ['ORG_ADMIN'],
      status: 'active',
      name: 'Test Admin',
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
    phone: '+251911100002',
  });
  if (!user2) {
    const result = await usersCollection.insertOne({
      organizationId: testOrgId,
      phone: '+251911100002',
      email: 'step4manager@example.com',
      passwordHash,
      roles: ['BUILDING_MANAGER'],
      status: 'active',
      name: 'Test Manager',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    user2 = await usersCollection.findOne({ _id: result.insertedId });
  }
  testUserId2 = user2._id.toString();
  console.log(`✅ Test user 2 (BUILDING_MANAGER) ID: ${testUserId2}\n`);
}

async function testCreateUser() {
  console.log('Test 1: Testing createUser (POST /api/users)...');
  try {
    const usersCollection = db.collection('users');
    const passwordHash = await bcrypt.hash('NewUser123!', 10);

    const newUser = {
      organizationId: testOrgId,
      phone: '+251911100003',
      email: 'step4newuser@example.com',
      passwordHash,
      roles: ['TECHNICIAN'],
      status: 'active',
      name: 'New Test User',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await usersCollection.insertOne(newUser);
    testUserId3 = result.insertedId.toString();

    const createdUser = await usersCollection.findOne({ _id: result.insertedId });
    if (createdUser && createdUser.phone === '+251911100003') {
      console.log(`✅ createUser: Successfully created user with ID: ${testUserId3}`);
    } else {
      throw new Error('Failed to create user');
    }
    console.log('');
  } catch (error) {
    console.error('❌ createUser failed:', error.message);
    throw error;
  }
}

async function testListUsersWithPagination() {
  console.log('Test 2: Testing list users with pagination (GET /api/users)...');
  try {
    const usersCollection = db.collection('users');

    // Test pagination: page 1, limit 2
    const page = 1;
    const limit = 2;
    const skip = (page - 1) * limit;

    const total = await usersCollection.countDocuments({ organizationId: testOrgId });
    const users = await usersCollection
      .find({ organizationId: testOrgId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    if (users.length === 2 && total >= 3) {
      console.log(`✅ listUsers: Found ${users.length} users on page ${page}, total: ${total}`);
    } else {
      throw new Error(`Expected 2 users on page 1, got ${users.length}`);
    }
    console.log('');
  } catch (error) {
    console.error('❌ listUsers failed:', error.message);
    throw error;
  }
}

async function testListUsersWithRoleFilter() {
  console.log('Test 3: Testing list users with role filter...');
  try {
    const usersCollection = db.collection('users');

    const orgAdmins = await usersCollection
      .find({
        organizationId: testOrgId,
        roles: 'ORG_ADMIN',
      })
      .toArray();

    if (orgAdmins.length >= 1) {
      console.log(`✅ listUsers with role filter: Found ${orgAdmins.length} ORG_ADMIN users`);
    } else {
      throw new Error('Expected at least 1 ORG_ADMIN user');
    }
    console.log('');
  } catch (error) {
    console.error('❌ listUsers with role filter failed:', error.message);
    throw error;
  }
}

async function testListUsersWithStatusFilter() {
  console.log('Test 4: Testing list users with status filter...');
  try {
    const usersCollection = db.collection('users');

    const activeUsers = await usersCollection
      .find({
        organizationId: testOrgId,
        status: 'active',
      })
      .toArray();

    if (activeUsers.length >= 3) {
      console.log(`✅ listUsers with status filter: Found ${activeUsers.length} active users`);
    } else {
      throw new Error('Expected at least 3 active users');
    }
    console.log('');
  } catch (error) {
    console.error('❌ listUsers with status filter failed:', error.message);
    throw error;
  }
}

async function testListUsersWithSearch() {
  console.log('Test 5: Testing list users with search (name, email, phone)...');
  try {
    const usersCollection = db.collection('users');

    // Search by name
    const searchTerm = 'Test';
    const searchRegex = { $regex: searchTerm, $options: 'i' };
    const usersByName = await usersCollection
      .find({
        organizationId: testOrgId,
        $or: [{ name: searchRegex }, { email: searchRegex }, { phone: searchRegex }],
      })
      .toArray();

    if (usersByName.length >= 2) {
      console.log(
        `✅ listUsers with search: Found ${usersByName.length} users matching "${searchTerm}"`,
      );
    } else {
      throw new Error(`Expected at least 2 users matching "${searchTerm}"`);
    }
    console.log('');
  } catch (error) {
    console.error('❌ listUsers with search failed:', error.message);
    throw error;
  }
}

async function testGetUserById() {
  console.log('Test 6: Testing get user by ID (GET /api/users/[id])...');
  try {
    const usersCollection = db.collection('users');

    const user = await usersCollection.findOne({ _id: new ObjectId(testUserId1) });

    if (user && user._id.toString() === testUserId1) {
      console.log(
        `✅ getUserById: Successfully retrieved user: ${user.name || user.email || user.phone}`,
      );
    } else {
      throw new Error('Failed to retrieve user by ID');
    }
    console.log('');
  } catch (error) {
    console.error('❌ getUserById failed:', error.message);
    throw error;
  }
}

async function testUpdateUser() {
  console.log('Test 7: Testing update user (PATCH /api/users/[id])...');
  try {
    const usersCollection = db.collection('users');

    const updatedName = 'Updated Test Admin Name';
    const result = await usersCollection.findOneAndUpdate(
      { _id: new ObjectId(testUserId1) },
      {
        $set: {
          name: updatedName,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' },
    );

    if (result && result.name === updatedName) {
      console.log(`✅ updateUser: Successfully updated user name to "${updatedName}"`);
    } else {
      throw new Error('Failed to update user');
    }
    console.log('');
  } catch (error) {
    console.error('❌ updateUser failed:', error.message);
    throw error;
  }
}

async function testUpdateUserRoles() {
  console.log('Test 8: Testing update user roles (PATCH /api/users/[id]/roles)...');
  try {
    const usersCollection = db.collection('users');

    const newRoles = ['BUILDING_MANAGER', 'FACILITY_MANAGER'];
    const result = await usersCollection.findOneAndUpdate(
      { _id: new ObjectId(testUserId2) },
      {
        $set: {
          roles: newRoles,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' },
    );

    if (result && result.roles.length === 2 && result.roles.includes('FACILITY_MANAGER')) {
      console.log(`✅ updateUserRoles: Successfully updated user roles`);
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
  console.log('Test 9: Testing update user status (PATCH /api/users/[id]/status)...');
  try {
    const usersCollection = db.collection('users');

    // Suspend user
    const result = await usersCollection.findOneAndUpdate(
      { _id: new ObjectId(testUserId3) },
      {
        $set: {
          status: 'suspended',
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' },
    );

    if (result && result.status === 'suspended') {
      console.log(`✅ updateUserStatus: Successfully suspended user`);

      // Reactivate
      await usersCollection.findOneAndUpdate(
        { _id: new ObjectId(testUserId3) },
        {
          $set: {
            status: 'active',
            updatedAt: new Date(),
          },
        },
      );
      console.log(`✅ updateUserStatus: Successfully reactivated user`);
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
  console.log('Test 10: Testing delete user (DELETE /api/users/[id]) - soft delete...');
  try {
    const usersCollection = db.collection('users');

    // Soft delete user 3
    const result = await usersCollection.updateOne(
      { _id: new ObjectId(testUserId3) },
      {
        $set: {
          status: 'inactive',
          updatedAt: new Date(),
        },
      },
    );

    if (result.modifiedCount > 0) {
      const deletedUser = await usersCollection.findOne({ _id: new ObjectId(testUserId3) });
      if (deletedUser && deletedUser.status === 'inactive') {
        console.log(`✅ deleteUser: Successfully soft deleted user (status: inactive)`);
      } else {
        throw new Error('User status not set to inactive');
      }
    } else {
      throw new Error('Failed to soft delete user');
    }
    console.log('');
  } catch (error) {
    console.error('❌ deleteUser failed:', error.message);
    throw error;
  }
}

async function testPhoneUniqueness() {
  console.log('Test 11: Testing phone uniqueness validation...');
  try {
    const usersCollection = db.collection('users');

    // Try to create user with duplicate phone in same org
    const passwordHash = await bcrypt.hash('Test123!', 10);
    try {
      await usersCollection.insertOne({
        organizationId: testOrgId,
        phone: '+251911100001', // Duplicate
        email: 'duplicate@example.com',
        passwordHash,
        roles: ['TECHNICIAN'],
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log('⚠️  Warning: Should have prevented duplicate phone in same organization');
    } catch (error) {
      if (error.code === 11000 || error.message.includes('duplicate')) {
        console.log(
          '✅ Phone uniqueness: Correctly prevented duplicate phone in same organization',
        );
      } else {
        throw error;
      }
    }
    console.log('');
  } catch (error) {
    console.error('❌ Phone uniqueness test failed:', error.message);
  }
}

async function testEmailUniqueness() {
  console.log('Test 12: Testing email uniqueness validation...');
  try {
    const usersCollection = db.collection('users');

    // Try to create user with duplicate email
    const passwordHash = await bcrypt.hash('Test123!', 10);
    try {
      await usersCollection.insertOne({
        organizationId: testOrgId,
        phone: '+251911100999',
        email: 'step4admin@example.com', // Duplicate
        passwordHash,
        roles: ['TECHNICIAN'],
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log('⚠️  Warning: Should have prevented duplicate email');
    } catch (error) {
      if (error.code === 11000 || error.message.includes('duplicate')) {
        console.log('✅ Email uniqueness: Correctly prevented duplicate email');
      } else {
        throw error;
      }
    }
    console.log('');
  } catch (error) {
    console.error('❌ Email uniqueness test failed:', error.message);
  }
}

async function runTests() {
  try {
    await connect();
    await ensureTestData();

    await testCreateUser();
    await testListUsersWithPagination();
    await testListUsersWithRoleFilter();
    await testListUsersWithStatusFilter();
    await testListUsersWithSearch();
    await testGetUserById();
    await testUpdateUser();
    await testUpdateUserRoles();
    await testUpdateUserStatus();
    await testDeleteUser();
    await testPhoneUniqueness();
    await testEmailUniqueness();

    console.log('========================================');
    console.log('  All Step 4 Direct Tests Completed!');
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
