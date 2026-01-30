import mongoose, { Schema, Document, Model } from 'mongoose'

/**
 * User interface matching the data structure from Clerk
 */
export interface IUser extends Document {
  clerk_id: string // Clerk user ID (unique identifier)
  email: string
  username?: string
  full_name?: string
  profile_picture?: string
  verification_status?: 'verified' | 'pending' | 'failed' | 'unverified'
  
  // Additional fields for Rentany app
  bio?: string
  preferred_language?: string
  role?: 'user' | 'admin'
  stripe_account_id?: string // Stripe Connect account ID (for owners receiving payments)
  stripe_customer_id?: string // Stripe Customer ID (for renters making payments)
  stripe_payment_method_id?: string // Stripe Payment Method ID (for renters - the card they use to pay)
  payouts_enabled?: boolean
  intent?: 'renter' | 'owner' | 'both' // User's intended role on the platform
  
  // Notification preferences
  notification_preferences?: {
    email_notifications?: boolean
    push_notifications?: boolean
    rental_requests?: boolean
    messages?: boolean
    payment_updates?: boolean
    reviews?: boolean
    promotions?: boolean
    transaction_completed?: boolean
    payout_initiated?: boolean
  }
  
  // Push notification subscription
  push_subscription?: {
    enabled: boolean
    subscribedAt?: string
    userAgent?: string
  }
  
  // Documents for verification
  documents?: Array<{
    id: string
    name: string
    url: string
    type: string
    uploadedAt: string
  }>
  
  // Timestamps
  created_at: Date
  updated_at: Date
  last_synced_from_clerk?: Date // Track when we last synced from Clerk
}

/**
 * User schema for MongoDB
 */
const UserSchema = new Schema<IUser>(
  {
    clerk_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
    },
    username: {
      type: String,
      unique: true,
      sparse: true, // Allow multiple null values
      trim: true,
      lowercase: true,
    },
    full_name: {
      type: String,
      trim: true,
    },
    profile_picture: {
      type: String,
    },
    verification_status: {
      type: String,
      enum: ['verified', 'pending', 'failed', 'unverified'],
      default: 'unverified',
    },
    bio: {
      type: String,
      maxlength: 500,
    },
    preferred_language: {
      type: String,
      default: 'en',
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    stripe_account_id: {
      type: String,
    },
    stripe_customer_id: {
      type: String,
    },
    stripe_payment_method_id: {
      type: String,
    },
    payouts_enabled: {
      type: Boolean,
      default: false,
    },
    intent: {
      type: String,
      enum: ['renter', 'owner', 'both'],
      default: undefined, // No default - must be set during onboarding
    },
    notification_preferences: {
      email_notifications: { type: Boolean, default: true },
      push_notifications: { type: Boolean, default: true },
      rental_requests: { type: Boolean, default: true },
      messages: { type: Boolean, default: true },
      payment_updates: { type: Boolean, default: true },
      reviews: { type: Boolean, default: true },
      promotions: { type: Boolean, default: true },
      transaction_completed: { type: Boolean, default: true },
      payout_initiated: { type: Boolean, default: true },
    },
    push_subscription: {
      enabled: { type: Boolean, default: false },
      subscribedAt: { type: String },
      userAgent: { type: String },
    },
    documents: [
      {
        id: String,
        name: String,
        url: String,
        type: String,
        uploadedAt: String,
      },
    ],
    last_synced_from_clerk: {
      type: Date,
    },
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  }
)

// Create indexes for better query performance
UserSchema.index({ email: 1 })
UserSchema.index({ clerk_id: 1 })
UserSchema.index({ username: 1 })

/**
 * User model
 * Mongoose automatically pluralizes 'User' to 'users' collection
 * This will save to: rentany_platform.users collection
 */
const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema, 'users')

export default User
