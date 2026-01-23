import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/clerk'
import Stripe from 'stripe'
import { STRIPE_SECRET_KEY, FRONTEND_URL } from '../config/env'
import { getOrSyncUser, updateUser } from '../services/userSync'

const router = Router()

// Initialize Stripe (will be undefined if key is missing)
let stripe: Stripe | null = null
try {
  if (STRIPE_SECRET_KEY) {
    stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2025-12-15.clover',
    })
  }
} catch (error) {
  console.error('Failed to initialize Stripe:', error)
}

/**
 * POST /api/verification/session
 * Create a Stripe Identity verification session
 * Returns a URL to redirect the user to Stripe's verification flow
 */
router.post('/session', requireAuth, async (req: Request, res: Response) => {
  try {
    // Get authenticated user
    let auth: { userId?: string | null } | undefined
    try {
      if (typeof (req as any).auth === 'function') {
        auth = (req as any).auth()
      } else {
        auth = (req as any).auth
      }
    } catch {
      auth = (req as any).auth
    }
    const userId = auth?.userId

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      })
    }

    // Check if Stripe is configured
    if (!stripe) {
      return res.status(500).json({
        success: false,
        error: 'Stripe is not configured. Please add STRIPE_SECRET_KEY to your .env file',
      })
    }

    // Get user from database
    const user = await getOrSyncUser(userId)
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      })
    }

    // Create Stripe Identity verification session
    // Using test mode - Stripe Identity will work in test mode with test API keys
    const verificationSession = await stripe.identity.verificationSessions.create({
      type: 'document', // Document verification type
      metadata: {
        user_id: userId,
        user_email: user.email,
      },
      return_url: `${FRONTEND_URL}/profile?verification=complete`,
      options: {
        document: {
          // In test mode, you can use test document numbers
          // For production, remove this to use real documents
          allowed_types: ['driving_license', 'id_card', 'passport'],
        },
      },
    })

    // Update user verification status to 'pending'
    await updateUser(userId, {
      verification_status: 'pending',
    })

    console.log(`✅ Created Stripe Identity verification session for user ${userId}`)
    console.log(`   Session ID: ${verificationSession.id}`)
    console.log(`   Status: ${verificationSession.status}`)

    // Return the verification URL
    res.json({
      success: true,
      data: {
        url: verificationSession.url || '',
        session_id: verificationSession.id,
      },
    })
  } catch (error: any) {
    console.error('Error creating verification session:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create verification session',
    })
  }
})

/**
 * GET /api/verification/status
 * Get the current verification status for the authenticated user
 */
router.get('/status', requireAuth, async (req: Request, res: Response) => {
  try {
    // Get authenticated user
    let auth: { userId?: string | null } | undefined
    try {
      if (typeof (req as any).auth === 'function') {
        auth = (req as any).auth()
      } else {
        auth = (req as any).auth
      }
    } catch {
      auth = (req as any).auth
    }
    const userId = auth?.userId

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      })
    }

    // Get user from database
    const user = await getOrSyncUser(userId)
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      })
    }

    res.json({
      success: true,
      data: {
        verification_status: user.verification_status || 'unverified',
      },
    })
  } catch (error: any) {
    console.error('Error getting verification status:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get verification status',
    })
  }
})

export default router
