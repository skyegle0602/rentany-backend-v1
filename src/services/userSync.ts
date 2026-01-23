import { clerkClientInstance } from '../middleware/clerk'
import User, { IUser } from '../models/users'
import { isDatabaseConnected } from '../config/database'
import mongoose, { Document } from 'mongoose'

/**
 * Sync user data from Clerk to MongoDB
 * This function fetches user data from Clerk and creates/updates the user in MongoDB
 */
export async function syncUserFromClerk(clerkUserId: string): Promise<(Document & IUser) | null> {
  // Check if database is connected before making queries
  if (!isDatabaseConnected()) {
    console.error('❌ MongoDB is not connected. Cannot sync user.')
    throw new Error('Database connection not established')
  }

  try {
    // Fetch user from Clerk
    const clerkUser = await clerkClientInstance.users.getUser(clerkUserId)

    if (!clerkUser) {
      console.error(`User not found in Clerk: ${clerkUserId}`)
      return null
    }

    // Helper to convert timestamp to Date
    const toDate = (timestamp: number | Date | undefined): Date | undefined => {
      if (!timestamp) return undefined
      if (timestamp instanceof Date) return timestamp
      if (typeof timestamp === 'number') {
        // If it's a Unix timestamp in seconds, convert to milliseconds
        return timestamp < 10000000000 
          ? new Date(timestamp * 1000) 
          : new Date(timestamp)
      }
      return undefined
    }

    // Prepare user data for MongoDB
    // IMPORTANT: verification_status is NOT synced from Clerk - it's managed by Stripe Identity
    // We only set it to 'unverified' for new users via $setOnInsert
    const userData = {
      clerk_id: clerkUser.id,
      email: clerkUser.emailAddresses[0]?.emailAddress || '',
      username: clerkUser.username || undefined,
      full_name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || undefined,
      profile_picture: clerkUser.imageUrl || undefined,
      last_synced_from_clerk: new Date(),
    }

    // Find existing user or create new one
    // Important: We do NOT set verification_status in $set to preserve existing Stripe Identity status
    // Only set it to 'unverified' for new users via $setOnInsert
    const user = await User.findOneAndUpdate(
      { clerk_id: clerkUserId },
      {
        $set: {
          ...userData,
          updated_at: new Date(),
        },
        $setOnInsert: {
          created_at: toDate(clerkUser.createdAt) || new Date(),
          verification_status: 'unverified' as const, // New users start as unverified
        },
      },
      {
        upsert: true, // Create if doesn't exist
        new: true, // Return updated document
        runValidators: true,
      }
    )

    const isNewUser = !user.created_at || user.created_at.getTime() === user.updated_at.getTime()
    console.log(`${isNewUser ? '✨ Created' : '🔄 Updated'} user in MongoDB:`)
    console.log(`   Database: rentany_platform`)
    console.log(`   Collection: users`)
    console.log(`   Email: ${user.email}`)
    console.log(`   Clerk ID: ${user.clerk_id}`)
    console.log(`   MongoDB ID: ${user._id}`)
    return user

  } catch (error) {
    console.error(`Error syncing user from Clerk (${clerkUserId}):`, error)
    throw error
  }
}

/**
 * Get user from MongoDB by Clerk ID
 * If user doesn't exist, sync from Clerk first
 */
export async function getOrSyncUser(clerkUserId: string): Promise<(Document & IUser) | null> {
  // Check if database is connected before making queries
  if (!isDatabaseConnected()) {
    console.error('❌ MongoDB is not connected. Cannot get/sync user.')
    console.error(`   Connection state: ${mongoose.connection.readyState}`)
    console.error(`   Attempting to reconnect...`)
    
    // Try to wait a bit and check again (in case connection is still establishing)
    await new Promise(resolve => setTimeout(resolve, 500))
    
    if (!isDatabaseConnected()) {
      throw new Error('Database connection not established')
    }
  }

  try {
    // First, try to find user in MongoDB
    let user = await User.findOne({ clerk_id: clerkUserId })

    // If user doesn't exist, sync from Clerk
    if (!user) {
      console.log(`🔄 Syncing new user from Clerk: ${clerkUserId}`)
      const syncedUser = await syncUserFromClerk(clerkUserId)
      // Type assertion: syncUserFromClerk returns the same Mongoose document type
      user = syncedUser as typeof user
    }

    return user
  } catch (error) {
    console.error(`Error getting/syncing user (${clerkUserId}):`, error)
    return null
  }
}

/**
 * Get user from MongoDB by email
 */
export async function getUserByEmail(email: string): Promise<(Document & IUser) | null> {
  // Check if database is connected before making queries
  if (!isDatabaseConnected()) {
    console.error('❌ MongoDB is not connected. Cannot get user by email.')
    throw new Error('Database connection not established')
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase().trim() })
    return user
  } catch (error) {
    console.error(`Error getting user by email (${email}):`, error)
    return null
  }
}

/**
 * Update user data in MongoDB
 * This is used for updating app-specific fields (not synced from Clerk)
 */
export async function updateUser(
  clerkUserId: string,
  updateData: Partial<IUser>
): Promise<(Document & IUser) | null> {
  // Check if database is connected before making queries
  if (!isDatabaseConnected()) {
    console.error('❌ MongoDB is not connected. Cannot update user.')
    throw new Error('Database connection not established')
  }

  try {
    const user = await User.findOneAndUpdate(
      { clerk_id: clerkUserId },
      {
        $set: {
          ...updateData,
          updated_at: new Date(),
        },
      },
      {
        new: true,
        runValidators: true,
      }
    )

    if (!user) {
      console.warn(`User not found for update: ${clerkUserId}`)
      // Try to sync from Clerk first, then update
      // But if Clerk user doesn't exist, just return null instead of throwing
      try {
        await syncUserFromClerk(clerkUserId)
        // After syncing, try to update again
        return await User.findOneAndUpdate(
          { clerk_id: clerkUserId },
          {
            $set: {
              ...updateData,
              updated_at: new Date(),
            },
          },
          {
            new: true,
            runValidators: true,
          }
        )
      } catch (clerkError: any) {
        // If Clerk user doesn't exist (404), check if user exists in MongoDB anyway
        // This can happen with webhooks where user_id might be stored but Clerk user was deleted
        console.warn(`Could not sync from Clerk for ${clerkUserId}:`, clerkError.message)
        
        // Check if user exists in MongoDB (maybe created via webhook or other means)
        const existingUser = await User.findOne({ clerk_id: clerkUserId })
        if (existingUser) {
          // User exists in MongoDB, update it directly
          console.log(`User exists in MongoDB, updating directly without Clerk sync`)
          return await User.findOneAndUpdate(
            { clerk_id: clerkUserId },
            {
              $set: {
                ...updateData,
                updated_at: new Date(),
              },
            },
            {
              new: true,
              runValidators: true,
            }
          )
        }
        
        // User doesn't exist in MongoDB or Clerk, throw the error
        throw clerkError
      }
    }

    return user
  } catch (error) {
    console.error(`Error updating user (${clerkUserId}):`, error)
    throw error
  }
}

/**
 * Convert MongoDB user document to API response format
 */
export function formatUserForAPI(user: IUser) {
  return {
    id: user._id.toString(),
    clerk_id: user.clerk_id, // Include clerk_id for matching with owner_id in items
    email: user.email,
    username: user.username,
    full_name: user.full_name,
    profile_picture: user.profile_picture,
    verification_status: user.verification_status,
    bio: user.bio,
    preferred_language: user.preferred_language,
    role: user.role,
    stripe_account_id: user.stripe_account_id,
    payouts_enabled: user.payouts_enabled,
    notification_preferences: user.notification_preferences,
    push_subscription: user.push_subscription,
    documents: user.documents,
    created_at: user.created_at?.toISOString(),
    updated_at: user.updated_at?.toISOString(),
  }
}
