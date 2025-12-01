#!/usr/bin/env node

/**
 * Direct MongoDB test for User Activity Logs (Step 9)
 * Tests activity logging collection, indexes, and queries
 */

import { MongoClient, ObjectId } from 'mongodb';

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://bms_root:bms_password@localhost:27021/bms?authSource=admin';

let client;
let db;
let collection;

async function connect() {
  try {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db();
    collection = db.collection('userActivityLogs');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ Failed to connect:', error.message);
    process.exit(1);
  }
}

async function cleanup() {
  try {
    await collection.deleteMany({});
    console.log('✅ Cleaned up test data');
  } catch (error) {
    console.error('⚠️  Cleanup warning:', error.message);
  }
}

async function testIndexes() {
  console.log('\n📋 Testing Indexes...');
  try {
    const indexes = await collection.indexes();
    console.log(`✅ Found ${indexes.length} indexes`);

    const expectedIndexes = [
      'userId_createdAt_desc',
      'orgId_action_createdAt_desc',
      'organizationId',
      'action',
      'createdAt_desc',
    ];

    const indexNames = indexes.map((idx) => idx.name);
    for (const expected of expectedIndexes) {
      if (indexNames.includes(expected)) {
        console.log(`  ✅ Index '${expected}' exists`);
      } else {
        console.log(`  ❌ Index '${expected}' missing`);
      }
    }
  } catch (error) {
    console.error('❌ Index test failed:', error.message);
  }
}

async function testCreateActivityLog() {
  console.log('\n📋 Testing Create Activity Log...');
  try {
    const testUserId = new ObjectId();
    const testOrgId = new ObjectId();

    const logEntry = {
      userId: testUserId,
      organizationId: testOrgId,
      action: 'login',
      details: { method: 'password' },
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
      createdAt: new Date(),
    };

    const result = await collection.insertOne(logEntry);
    console.log(`✅ Created activity log: ${result.insertedId}`);

    // Verify it was saved
    const saved = await collection.findOne({ _id: result.insertedId });
    if (saved && saved.action === 'login') {
      console.log('  ✅ Log entry verified');
      return { logId: result.insertedId, userId: testUserId, orgId: testOrgId };
    } else {
      console.log('  ❌ Log entry verification failed');
      return null;
    }
  } catch (error) {
    console.error('❌ Create activity log failed:', error.message);
    return null;
  }
}

async function testQueryByUserId(testData) {
  console.log('\n📋 Testing Query by User ID...');
  if (!testData) {
    console.log('  ⚠️  Skipping - no test data');
    return;
  }

  try {
    const logs = await collection
      .find({ userId: testData.userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();

    console.log(`✅ Found ${logs.length} log(s) for user`);
    if (logs.length > 0) {
      console.log(`  ✅ Latest action: ${logs[0].action}`);
    }
  } catch (error) {
    console.error('❌ Query by user ID failed:', error.message);
  }
}

async function testQueryByAction() {
  console.log('\n📋 Testing Query by Action...');
  try {
    // Create multiple logs with different actions
    const testUserId = new ObjectId();
    const testOrgId = new ObjectId();

    const actions = ['login', 'logout', 'password_change', 'profile_update'];
    for (const action of actions) {
      await collection.insertOne({
        userId: testUserId,
        organizationId: testOrgId,
        action,
        createdAt: new Date(),
      });
    }

    // Query by specific action
    const loginLogs = await collection.find({ action: 'login' }).toArray();

    console.log(`✅ Found ${loginLogs.length} login log(s)`);

    // Query by organization and action
    const orgLogs = await collection.find({ organizationId: testOrgId, action: 'login' }).toArray();

    console.log(`✅ Found ${orgLogs.length} login log(s) for organization`);
  } catch (error) {
    console.error('❌ Query by action failed:', error.message);
  }
}

async function testDateRangeQuery() {
  console.log('\n📋 Testing Date Range Query...');
  try {
    const testUserId = new ObjectId();
    const testOrgId = new ObjectId();

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Create logs with different dates
    await collection.insertOne({
      userId: testUserId,
      organizationId: testOrgId,
      action: 'login',
      createdAt: yesterday,
    });

    await collection.insertOne({
      userId: testUserId,
      organizationId: testOrgId,
      action: 'logout',
      createdAt: now,
    });

    // Query within date range
    const logs = await collection
      .find({
        userId: testUserId,
        createdAt: {
          $gte: yesterday,
          $lte: tomorrow,
        },
      })
      .sort({ createdAt: -1 })
      .toArray();

    console.log(`✅ Found ${logs.length} log(s) in date range`);
    if (logs.length >= 2) {
      console.log('  ✅ Date range query working correctly');
    }
  } catch (error) {
    console.error('❌ Date range query failed:', error.message);
  }
}

async function testMultipleActions() {
  console.log('\n📋 Testing Multiple Action Types...');
  try {
    const testUserId = new ObjectId();
    const testOrgId = new ObjectId();

    const actions = [
      { action: 'login', details: { method: 'password' } },
      { action: 'logout', details: null },
      { action: 'password_change', details: { changedBy: 'self' } },
      { action: 'profile_update', details: { fields: ['name', 'email'] } },
      { action: 'role_assigned', details: { roles: ['ORG_ADMIN'] } },
      { action: 'status_changed', details: { newStatus: 'active' } },
    ];

    for (const logData of actions) {
      await collection.insertOne({
        userId: testUserId,
        organizationId: testOrgId,
        action: logData.action,
        details: logData.details,
        ipAddress: '192.168.1.1',
        userAgent: 'Test Agent',
        createdAt: new Date(),
      });
    }

    // Query all logs for user
    const allLogs = await collection.find({ userId: testUserId }).sort({ createdAt: -1 }).toArray();

    console.log(`✅ Created and retrieved ${allLogs.length} log(s) with different actions`);

    // Verify all actions are present
    const actionTypes = allLogs.map((log) => log.action);
    const uniqueActions = [...new Set(actionTypes)];
    console.log(`  ✅ Unique actions: ${uniqueActions.join(', ')}`);
  } catch (error) {
    console.error('❌ Multiple actions test failed:', error.message);
  }
}

async function testIPAndUserAgent() {
  console.log('\n📋 Testing IP Address and User Agent...');
  try {
    const testUserId = new ObjectId();
    const testOrgId = new ObjectId();

    const logEntry = {
      userId: testUserId,
      organizationId: testOrgId,
      action: 'login',
      ipAddress: '203.0.113.42',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      createdAt: new Date(),
    };

    await collection.insertOne(logEntry);

    const saved = await collection.findOne({ userId: testUserId });
    if (saved && saved.ipAddress === '203.0.113.42' && saved.userAgent) {
      console.log('✅ IP address and user agent saved correctly');
      console.log(`  IP: ${saved.ipAddress}`);
      console.log(`  User Agent: ${saved.userAgent.substring(0, 50)}...`);
    } else {
      console.log('❌ IP address or user agent not saved correctly');
    }
  } catch (error) {
    console.error('❌ IP/User Agent test failed:', error.message);
  }
}

async function testDetailsField() {
  console.log('\n📋 Testing Details Field...');
  try {
    const testUserId = new ObjectId();
    const testOrgId = new ObjectId();

    const complexDetails = {
      changedBy: new ObjectId().toString(),
      previousRoles: ['TENANT'],
      newRoles: ['ORG_ADMIN', 'BUILDING_MANAGER'],
      reason: 'Promotion to admin',
    };

    await collection.insertOne({
      userId: testUserId,
      organizationId: testOrgId,
      action: 'role_assigned',
      details: complexDetails,
      createdAt: new Date(),
    });

    const saved = await collection.findOne({ userId: testUserId });
    if (saved && saved.details && saved.details.newRoles) {
      console.log('✅ Complex details saved correctly');
      console.log(`  New roles: ${saved.details.newRoles.join(', ')}`);
    } else {
      console.log('❌ Details not saved correctly');
    }
  } catch (error) {
    console.error('❌ Details field test failed:', error.message);
  }
}

async function runTests() {
  console.log('🧪 Starting User Activity Logs Direct MongoDB Tests\n');

  await connect();
  await cleanup();
  await testIndexes();

  const testData = await testCreateActivityLog();
  await testQueryByUserId(testData);
  await testQueryByAction();
  await testDateRangeQuery();
  await testMultipleActions();
  await testIPAndUserAgent();
  await testDetailsField();

  console.log('\n✅ All tests completed!');

  await client.close();
}

runTests().catch(console.error);
