/**
 * Script to make a user an admin
 * Usage: npx ts-node backend/scripts/make-admin.ts <email>
 * Example: npx ts-node backend/scripts/make-admin.ts tasubasa0602@gmail.com
 */

import mongoose from 'mongoose';
import User from '../src/models/users';
import { connectDatabase } from '../src/config/database';
import { MONGODB_URI } from '../src/config/env';

async function makeAdmin(email: string) {
  try {
    console.log('🔌 Connecting to database...');
    await connectDatabase();
    console.log('✅ Connected to database');

    // Normalize email (lowercase, trim)
    const normalizedEmail = email.toLowerCase().trim();
    console.log(`🔍 Looking for user with email: ${normalizedEmail}`);

    // Find user by email
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      console.error(`❌ User with email ${normalizedEmail} not found in database.`);
      console.log('💡 Make sure the user has signed in at least once to create their account.');
      process.exit(1);
    }

    console.log(`✅ Found user: ${user.full_name || user.email}`);
    console.log(`   Current role: ${user.role || 'user'}`);
    console.log(`   Clerk ID: ${user.clerk_id}`);

    // Update role to admin
    user.role = 'admin';
    await user.save();

    console.log(`\n🎉 Success! User ${normalizedEmail} is now an admin.`);
    console.log(`   Updated role: ${user.role}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error making user admin:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
}

// Get email from command line arguments
const email = process.argv[2];

if (!email) {
  console.error('❌ Please provide an email address.');
  console.log('Usage: npx ts-node backend/scripts/make-admin.ts <email>');
  console.log('Example: npx ts-node backend/scripts/make-admin.ts tasubasa0602@gmail.com');
  process.exit(1);
}

makeAdmin(email);
