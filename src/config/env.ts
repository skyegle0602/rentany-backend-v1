// Load environment variables from .env file
// This must be at the very top, before any other imports
import dotenv from 'dotenv'
dotenv.config()

/**
 * Centralized environment variables configuration
 * All environment variables should be loaded and exported from here
 * Other files should import from this file instead of accessing process.env directly
 */

// Server configuration
export const PORT = process.env.PORT || 5000
export const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000'

// Clerk Authentication
export const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY || ''
export const CLERK_PUBLISHABLE_KEY = process.env.CLERK_PUBLISHABLE_KEY || ''
export const CLERK_WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET || ''

// MongoDB
export const MONGODB_URI = process.env.MONGODB_URI || ''

// Stripe
export const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || ''
export const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY || ''
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || ''

// Validation and warnings
if (!CLERK_SECRET_KEY) {
  console.warn('⚠️  CLERK_SECRET_KEY is not set in environment variables')
  console.warn('   Add it to your .env file: CLERK_SECRET_KEY=sk_test_...')
}

if (!CLERK_PUBLISHABLE_KEY) {
  console.warn('⚠️  CLERK_PUBLISHABLE_KEY is not set in environment variables')
  console.warn('   Add it to your .env file: CLERK_PUBLISHABLE_KEY=pk_test_...')
}

if (!MONGODB_URI) {
  console.warn('⚠️  MONGODB_URI is not set in environment variables')
  console.warn('   Add it to your .env file: MONGODB_URI=mongodb+srv://...')
}

if (!STRIPE_SECRET_KEY) {
  console.warn('⚠️  STRIPE_SECRET_KEY is not set in environment variables')
  console.warn('   Add it to your .env file: STRIPE_SECRET_KEY=sk_test_...')
}

if (!STRIPE_PUBLISHABLE_KEY) {
  console.warn('⚠️  STRIPE_PUBLISHABLE_KEY is not set in environment variables')
  console.warn('   Add it to your .env file: STRIPE_PUBLISHABLE_KEY=pk_test_...')
}
