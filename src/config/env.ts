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
// Normalize FRONTEND_URL by removing trailing slashes
export const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:3001').replace(/\/+$/, '')

// Allow multiple frontend URLs for development and production
// Comma-separated list of allowed origins (e.g., "http://localhost:3001,https://rentany-frontend-v1-zrtl.vercel.app")
export const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(url => url.trim().replace(/\/+$/, ''))
  : [FRONTEND_URL]

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

// AWS S3
export const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || ''
export const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || ''
export const AWS_REGION = process.env.AWS_REGION || 'us-east-1'
export const AWS_S3_BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'rentany-uploads'

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

if (!AWS_ACCESS_KEY_ID) {
  console.warn('⚠️  AWS_ACCESS_KEY_ID is not set in environment variables')
  console.warn('   Add it to your .env file: AWS_ACCESS_KEY_ID=...')
}

if (!AWS_SECRET_ACCESS_KEY) {
  console.warn('⚠️  AWS_SECRET_ACCESS_KEY is not set in environment variables')
  console.warn('   Add it to your .env file: AWS_SECRET_ACCESS_KEY=...')
}
