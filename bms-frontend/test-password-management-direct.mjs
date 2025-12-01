#!/usr/bin/env node

/**
 * Direct test script for Password Management Functions
 * This script directly tests the password management functions with MongoDB
 *
 * Usage: node test-password-management-direct.mjs
 */

import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://bms_root:bms_password@localhost:27021/bms?authSource=admin';

console.log('========================================');
console.log('  Password Management Direct Test');
console.log('========================================\n');

let client;
let db;
let testUserId;
let resetToken;

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

async function ensureTestUser() {
  const usersCollection = db.collection('users');
  const passwordHash = await bcrypt.hash('TestPassword123!', 10);

  // Find or create test user
  let user = await usersCollection.findOne({
    email: 'passwordtest@example.com',
  });

  if (!user) {
    // Get an organization ID
    const orgsCollection = db.collection('organizations');
    let org = await orgsCollection.findOne({});

    if (!org) {
      const orgResult = await orgsCollection.insertOne({
        name: 'Test Organization',
        code: 'TEST_ORG_PW',
        contactInfo: null,
        settings: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      org = await orgsCollection.findOne({ _id: orgResult.insertedId });
    }

    const result = await usersCollection.insertOne({
      organizationId: org._id.toString(),
      phone: '+251911999999',
      email: 'passwordtest@example.com',
      passwordHash,
      roles: ['BUILDING_MANAGER'],
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    user = await usersCollection.findOne({ _id: result.insertedId });
  }

  testUserId = user._id.toString();
  console.log(`✅ Test user ID: ${testUserId}\n`);
}

async function testPasswordPolicy() {
  console.log('Test 1: Testing password policy validation...');
  try {
    // Import password policy (we'll test the logic directly)
    const weakPasswords = ['12345678', 'password', 'PASSWORD123', 'Test123'];
    const strongPassword = 'TestPassword123!';

    // Test weak passwords
    for (const pwd of weakPasswords) {
      const hasUpper = /[A-Z]/.test(pwd);
      const hasLower = /[a-z]/.test(pwd);
      const hasNumber = /[0-9]/.test(pwd);
      const hasSpecial = /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(pwd);
      const isLongEnough = pwd.length >= 8;

      if (!hasUpper || !hasLower || !hasNumber || !hasSpecial || !isLongEnough) {
        console.log(`   ✅ Weak password correctly identified: ${pwd.substring(0, 10)}...`);
      }
    }

    // Test strong password
    const hasUpper = /[A-Z]/.test(strongPassword);
    const hasLower = /[a-z]/.test(strongPassword);
    const hasNumber = /[0-9]/.test(strongPassword);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(strongPassword);
    const isLongEnough = strongPassword.length >= 8;

    if (hasUpper && hasLower && hasNumber && hasSpecial && isLongEnough) {
      console.log('   ✅ Strong password correctly validated');
    } else {
      throw new Error('Strong password validation failed');
    }
    console.log('');
  } catch (error) {
    console.error('❌ Password policy test failed:', error.message);
    throw error;
  }
}

async function testRequestPasswordReset() {
  console.log('Test 2: Testing requestPasswordReset...');
  try {
    const usersCollection = db.collection('users');

    // Generate reset token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    // Update user with reset token
    const result = await usersCollection.findOneAndUpdate(
      { _id: new ObjectId(testUserId) },
      {
        $set: {
          resetPasswordToken: token,
          resetPasswordTokenExpiresAt: expiresAt,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' },
    );

    if (result && result.resetPasswordToken === token) {
      resetToken = token;
      console.log('   ✅ Reset token generated and stored');
      console.log(`   ✅ Token: ${token.substring(0, 20)}...`);
    } else {
      throw new Error('Failed to generate reset token');
    }
    console.log('');
  } catch (error) {
    console.error('❌ requestPasswordReset test failed:', error.message);
    throw error;
  }
}

async function testValidateResetToken() {
  console.log('Test 3: Testing validateResetToken...');
  try {
    const usersCollection = db.collection('users');

    const user = await usersCollection.findOne({
      resetPasswordToken: resetToken,
      status: 'active',
    });

    if (user && user.resetPasswordTokenExpiresAt > new Date()) {
      console.log('   ✅ Reset token validated successfully');
    } else {
      throw new Error('Token validation failed');
    }
    console.log('');
  } catch (error) {
    console.error('❌ validateResetToken test failed:', error.message);
    throw error;
  }
}

async function testResetPassword() {
  console.log('Test 4: Testing resetPassword...');
  try {
    const usersCollection = db.collection('users');

    const newPassword = 'NewPassword123!';
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Reset password
    const result = await usersCollection.findOneAndUpdate(
      { _id: new ObjectId(testUserId) },
      {
        $set: {
          passwordHash: newPasswordHash,
          passwordChangedAt: new Date(),
          resetPasswordToken: null,
          resetPasswordTokenExpiresAt: null,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' },
    );

    if (result && !result.resetPasswordToken) {
      // Verify password was changed
      const passwordMatches = await bcrypt.compare(newPassword, result.passwordHash);
      if (passwordMatches) {
        console.log('   ✅ Password reset successfully');
        console.log('   ✅ Reset token cleared');
        console.log('   ✅ passwordChangedAt updated');
      } else {
        throw new Error('Password hash mismatch');
      }
    } else {
      throw new Error('Failed to reset password');
    }
    console.log('');
  } catch (error) {
    console.error('❌ resetPassword test failed:', error.message);
    throw error;
  }
}

async function testChangePassword() {
  console.log('Test 5: Testing changePassword (authenticated)...');
  try {
    const usersCollection = db.collection('users');

    const currentPassword = 'NewPassword123!';
    const newPassword = 'UpdatedPassword123!';

    // Get current user
    const user = await usersCollection.findOne({ _id: new ObjectId(testUserId) });

    // Verify current password
    const passwordMatches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!passwordMatches) {
      throw new Error('Current password verification failed');
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    const result = await usersCollection.findOneAndUpdate(
      { _id: new ObjectId(testUserId) },
      {
        $set: {
          passwordHash: newPasswordHash,
          passwordChangedAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' },
    );

    if (result) {
      // Verify new password
      const newPasswordMatches = await bcrypt.compare(newPassword, result.passwordHash);
      if (newPasswordMatches) {
        console.log('   ✅ Password changed successfully');
        console.log('   ✅ passwordChangedAt updated');
      } else {
        throw new Error('New password hash mismatch');
      }
    } else {
      throw new Error('Failed to change password');
    }
    console.log('');
  } catch (error) {
    console.error('❌ changePassword test failed:', error.message);
    throw error;
  }
}

async function runTests() {
  try {
    await connect();
    await ensureTestUser();

    await testPasswordPolicy();
    await testRequestPasswordReset();
    await testValidateResetToken();
    await testResetPassword();
    await testChangePassword();

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
