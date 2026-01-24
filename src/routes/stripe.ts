import { Router, Request, Response } from 'express'
import { requireAuth, getAuth } from '../middleware/clerk'
import Stripe from 'stripe'
import { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } from '../config/env'
import { updateUser, getOrSyncUser } from '../services/userSync'

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

interface StripeDiagnosticResult {
  success: boolean
  keyType?: 'TEST' | 'LIVE'
  platformAccount?: {
    email?: string
    chargesEnabled?: boolean
    id?: string
  }
  connectEnabled?: boolean
  checkoutCapable?: boolean
  diagnosis?: string
  error?: string
  details?: string
  steps?: string[]
  connectError?: string
}

/**
 * POST /api/stripe/diagnostic
 * Run Stripe configuration diagnostic
 * Checks:
 * - API key presence and mode (TEST vs LIVE)
 * - Platform account status
 * - Stripe Connect enabled
 * - Checkout session creation capability
 */
router.post('/diagnostic', requireAuth, async (req: Request, res: Response) => {
  try {
    const result: StripeDiagnosticResult = {
      success: false,
    }

    // Check 1: API Key
    if (!STRIPE_SECRET_KEY) {
      result.error = 'Stripe API key is missing'
      result.details = 'Add STRIPE_SECRET_KEY to your .env file'
      result.steps = [
        'Get your Stripe API key from: https://dashboard.stripe.com/apikeys',
        'Add STRIPE_SECRET_KEY=sk_test_... to backend/.env',
        'Restart the server',
      ]
      return res.json({ success: false, data: result })
    }

    const apiKey = STRIPE_SECRET_KEY
    result.keyType = apiKey.startsWith('sk_live_') ? 'LIVE' : 'TEST'

    // Check 2: Stripe Client Initialization
    if (!stripe) {
      result.error = 'Failed to initialize Stripe client'
      result.details = 'Check your STRIPE_SECRET_KEY format'
      result.steps = [
        'Verify STRIPE_SECRET_KEY starts with sk_test_ or sk_live_',
        'Check for any extra spaces or quotes in .env file',
        'Restart the server',
      ]
      return res.json({ success: false, data: result })
    }

    // Check 3: Platform Account (Retrieve account info)
    try {
      const account = await stripe.accounts.retrieve()
      result.platformAccount = {
        id: account.id,
        email: account.email || undefined,
        chargesEnabled: account.charges_enabled || false,
      }
    } catch (error: any) {
      result.error = 'Failed to retrieve platform account'
      result.details = error.message || 'Unknown error'
      result.steps = [
        'Verify your Stripe API key is valid',
        'Check Stripe Dashboard: https://dashboard.stripe.com',
        'Ensure your account is activated',
      ]
      return res.json({ success: false, data: result })
    }

    // Check 4: Stripe Connect Enabled
    try {
      // Try to retrieve account capabilities to check if Connect is enabled
      // We'll check if the account can create Connect accounts
      const account = await stripe.accounts.retrieve()
      
      // Check if account has Connect capabilities
      // Connect is typically enabled if account has certain capabilities
      result.connectEnabled = account.capabilities?.transfers === 'active' || 
                              account.capabilities?.card_payments === 'active' ||
                              false
      
      if (!result.connectEnabled) {
        result.connectError = 'Stripe Connect may not be fully enabled'
        result.steps = [
          'Enable Stripe Connect in your dashboard: https://dashboard.stripe.com/settings/connect',
          'Complete the Connect onboarding process',
          'Verify your account is approved for Connect',
        ]
      }
    } catch (error: any) {
      result.connectEnabled = false
      result.connectError = error.message || 'Connect check failed'
      result.steps = [
        'Check Stripe Connect settings: https://dashboard.stripe.com/settings/connect',
        'Verify your account has Connect enabled',
        'Contact Stripe support if issues persist',
      ]
    }

    // Check 5: Checkout Session Creation (Test)
    try {
      // Create a test checkout session to verify capability
      const testSession = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: 'Test Diagnostic Item',
              },
              unit_amount: 100, // $1.00
            },
            quantity: 1,
          },
        ],
        success_url: 'https://example.com/success',
        cancel_url: 'https://example.com/cancel',
      })

      // Immediately expire the test session
      await stripe.checkout.sessions.expire(testSession.id)

      result.checkoutCapable = true
    } catch (error: any) {
      result.checkoutCapable = false
      result.error = result.error || 'Checkout session creation failed'
      result.details = error.message || 'Unknown error'
      
      if (!result.steps) {
        result.steps = [
          'Verify your Stripe account is activated',
          'Check payment method types are enabled',
          'Review Stripe Dashboard for account restrictions',
        ]
      }
    }

    // Overall Diagnosis
    if (result.connectEnabled && result.checkoutCapable && result.platformAccount?.chargesEnabled) {
      result.success = true
      result.diagnosis = '✅ Stripe is fully configured and ready for payments'
      result.details = `Platform account (${result.platformAccount.email || result.platformAccount.id}) can accept charges. Connect and Checkout are working.`
    } else {
      result.success = false
      const issues: string[] = []
      if (!result.platformAccount?.chargesEnabled) {
        issues.push('Platform account cannot accept charges')
      }
      if (!result.connectEnabled) {
        issues.push('Stripe Connect is not enabled')
      }
      if (!result.checkoutCapable) {
        issues.push('Checkout sessions cannot be created')
      }
      result.diagnosis = `⚠️ Stripe configuration has issues: ${issues.join(', ')}`
      result.details = 'Some features may not work correctly. See steps below to fix.'
    }

    res.json({ success: true, data: result })
  } catch (error: any) {
    console.error('Stripe diagnostic error:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
      data: {
        success: false,
        error: 'Unexpected error during diagnostic',
        details: error.message || 'Unknown error',
      },
    })
  }
})

/**
 * POST /api/stripe/webhook
 * Stripe webhook endpoint (alternative path for backward compatibility)
 * This route is PUBLIC (no auth required) - Stripe sends webhooks without authentication
 * 
 * Note: The main webhook handler is at /api/webhooks/stripe
 * This route handles requests sent to /api/stripe/webhook for compatibility
 */
router.post('/webhook', async (req: Request, res: Response) => {
  console.log('🔔 ===== STRIPE WEBHOOK RECEIVED (via /api/stripe/webhook) =====')
  console.log('📥 Request received at:', new Date().toISOString())
  console.log('📍 Path:', req.path)
  console.log('🌐 Method:', req.method)
  console.log('📋 Headers:', {
    'content-type': req.headers['content-type'],
    'stripe-signature': req.headers['stripe-signature'] ? 'Present ✅' : 'Missing ❌',
    'user-agent': req.headers['user-agent'],
  })

  const WEBHOOK_SECRET = STRIPE_WEBHOOK_SECRET

  if (!WEBHOOK_SECRET) {
    console.error('❌ STRIPE_WEBHOOK_SECRET is missing from environment variables')
    console.error('   Make sure you have STRIPE_WEBHOOK_SECRET=whsec_xxx in your .env file')
    console.error('   Get it from: Stripe Dashboard -> Webhooks -> Your endpoint -> Signing secret')
    return res.status(500).json({
      success: false,
      error: 'Webhook secret not configured',
    })
  }

  if (!WEBHOOK_SECRET.startsWith('whsec_')) {
    console.error('❌ STRIPE_WEBHOOK_SECRET format is incorrect!')
    console.error('   Expected format: whsec_xxxxx (webhook signing secret)')
    console.error('   Current value starts with:', WEBHOOK_SECRET.substring(0, 10))
    console.error('   ⚠️  Make sure you are NOT using STRIPE_SECRET_KEY (sk_test_xxx)')
    console.error('   Use the webhook signing secret from Stripe Dashboard')
  }

  if (!stripe) {
    console.error('❌ Stripe is not initialized')
    console.error('   Check if STRIPE_SECRET_KEY is set in .env')
    return res.status(500).json({
      success: false,
      error: 'Stripe is not configured',
    })
  }

  // Get the Stripe signature from headers
  const sig = req.headers['stripe-signature'] as string

  if (!sig) {
    console.error('❌ Missing stripe-signature header')
    console.error('   This request may not be from Stripe')
    return res.status(400).json({
      success: false,
      error: 'Missing stripe-signature header',
    })
  }

  console.log('🔐 Webhook signature found, verifying...')
  console.log('📦 Body type:', typeof req.body)
  console.log('📦 Body is Buffer:', Buffer.isBuffer(req.body))
  console.log('📦 Body length:', req.body ? (Buffer.isBuffer(req.body) ? req.body.length : JSON.stringify(req.body).length) : 0)

  let event: Stripe.Event

  // Verify the webhook signature
  try {
    // req.body should be a Buffer from express.raw() middleware
    // But if it's not, we need to handle it
    let body: Buffer | string
    if (Buffer.isBuffer(req.body)) {
      body = req.body
    } else if (typeof req.body === 'string') {
      body = Buffer.from(req.body, 'utf8')
    } else {
      body = Buffer.from(JSON.stringify(req.body), 'utf8')
    }

    console.log('🔍 Attempting to verify webhook signature...')
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      WEBHOOK_SECRET
    )
    console.log('✅ Webhook signature verified successfully!')
    console.log('📊 Event type:', event.type)
    console.log('🆔 Event ID:', event.id)
  } catch (err: any) {
    console.error('❌ Webhook signature verification FAILED!')
    console.error('   Error:', err.message)
    console.error('   This could mean:')
    console.error('   1. Wrong STRIPE_WEBHOOK_SECRET in .env (should be whsec_xxx)')
    console.error('   2. Request body was corrupted (check if express.raw() is applied)')
    console.error('   3. Request is not from Stripe')
    return res.status(400).json({
      success: false,
      error: `Webhook signature verification failed: ${err.message}`,
    })
  }

  console.log(`📥 Stripe webhook event received: ${event.type}`)
  console.log('📋 Event data:', {
    id: event.id,
    type: event.type,
    created: new Date(event.created * 1000).toISOString(),
    livemode: event.livemode,
  })

  try {
    // Handle Stripe webhook events
    // Handle account.updated event to mark users as verified when account becomes active
    if (event.type === 'account.updated') {
      const account = event.data.object as Stripe.Account
      console.log('📋 Account updated event:', {
        id: account.id,
        details_submitted: account.details_submitted,
        payouts_enabled: account.payouts_enabled,
      })

      // Find user by stripe_account_id
      const User = (await import('../models/users')).default
      const user = await User.findOne({ stripe_account_id: account.id })

      if (user) {
        // Only mark as verified if account is fully connected and payouts are enabled
        if (account.details_submitted && account.payouts_enabled) {
          await updateUser(user.clerk_id, {
            verification_status: 'verified',
            payouts_enabled: true,
          } as any)
          console.log(`✅ Marked user ${user.clerk_id} as verified - account is active`)
        } else {
          // Account exists but not fully connected yet
          await updateUser(user.clerk_id, {
            payouts_enabled: account.payouts_enabled || false,
            verification_status: 'unverified', // Not verified until account is fully connected
          } as any)
          console.log(`ℹ️  User ${user.clerk_id} account not fully connected yet`)
        }
      } else {
        console.warn(`⚠️  No user found with stripe_account_id: ${account.id}`)
      }
    } else {
      console.log('ℹ️  Unhandled Stripe event type:', event.type)
      console.log('   Add event handlers for specific event types as needed')
    }

    console.log('✅ ===== STRIPE WEBHOOK PROCESSED SUCCESSFULLY =====')
    res.json({ received: true })
  } catch (error) {
    console.error('❌ Error processing Stripe webhook:')
    console.error('   Error:', error)
    if (error instanceof Error) {
      console.error('   Message:', error.message)
      console.error('   Stack:', error.stack)
    }
    res.status(500).json({
      success: false,
      error: 'Error processing webhook',
    })
  }
})

/**
 * POST /api/stripe/connect/onboarding
 * Create Stripe Connect onboarding link for user
 */
router.post('/connect/onboarding', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!stripe) {
      return res.status(500).json({
        success: false,
        error: 'Stripe is not configured',
      })
    }

    // Get authenticated user using getAuth helper to avoid deprecation warnings
    const auth = getAuth(req)
    const userId = auth?.userId
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      })
    }

    const user = await getOrSyncUser(userId)
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      })
    }

    const { origin, return_path } = req.body

    // Check if user already has a Stripe Connect account
    let accountId = (user as any).stripe_account_id

    if (!accountId) {
      // Create a new Stripe Connect account
      const account = await stripe.accounts.create({
        type: 'express',
        email: user.email,
        metadata: {
          user_id: userId,
          clerk_id: userId,
        },
      })

      accountId = account.id

      // Save account ID to user
      // Don't mark as verified yet - wait until account is fully connected (details_submitted = true)
      await updateUser(userId, {
        stripe_account_id: accountId,
      } as any)
      
      console.log(`✅ Created Stripe Connect account for user ${userId}`)
    } else {
      // User already has an account - check if it's active and mark as verified if so
      const account = await stripe.accounts.retrieve(accountId)
      if (account.details_submitted && account.payouts_enabled) {
        // Account is fully connected - mark as verified
        await updateUser(userId, {
          verification_status: 'verified',
        } as any)
        console.log(`✅ Account for user ${userId} is active - marked as verified`)
      }
    }

    // Determine return URL - use provided return_path or default to profile wallet
    const returnUrl = return_path 
      ? `${origin}${return_path}?stripe=success`
      : `${origin}/profile?tab=wallet&stripe=success`
    
    const refreshUrl = return_path
      ? `${origin}${return_path}`
      : `${origin}/profile?tab=wallet`

    // Create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    })

    res.json({
      success: true,
      data: {
        url: accountLink.url,
      },
    })
  } catch (error: any) {
    console.error('Error creating Stripe Connect onboarding:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create onboarding link',
    })
  }
})

/**
 * GET /api/stripe/connect/status
 * Get Stripe Connect account status
 */
router.get('/connect/status', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!stripe) {
      return res.status(500).json({
        success: false,
        error: 'Stripe is not configured',
      })
    }

    // Get authenticated user using getAuth helper to avoid deprecation warnings
    const auth = getAuth(req)
    const userId = auth?.userId
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      })
    }

    const user = await getOrSyncUser(userId)
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      })
    }

    const accountId = (user as any).stripe_account_id
    if (!accountId) {
      // User doesn't have Stripe account - return not connected status
      // Don't modify verification_status here - it should only be set during onboarding
      return res.json({
        success: true,
        data: {
          payouts_enabled: false,
          status: 'not_connected',
        },
      })
    }

    // Retrieve account from Stripe
    const account = await stripe.accounts.retrieve(accountId)

    // Check if account is fully connected and update verification status accordingly
    const isFullyConnected = account.details_submitted && account.payouts_enabled
    const shouldBeVerified = isFullyConnected

    // Update user's payout status and verification status
    await updateUser(userId, {
      payouts_enabled: account.payouts_enabled || false,
      verification_status: shouldBeVerified ? 'verified' : 'unverified',
    } as any)

    if (shouldBeVerified && (user as any).verification_status !== 'verified') {
      console.log(`✅ User ${userId} account is fully connected - marked as verified (via status check)`)
    }

    res.json({
      success: true,
      data: {
        payouts_enabled: account.payouts_enabled || false,
        status: account.details_submitted ? 'active' : 'pending',
        requirements: account.requirements?.currently_due || [],
        verified: shouldBeVerified,
        details_submitted: account.details_submitted,
        payouts_enabled_stripe: account.payouts_enabled,
      },
    })
  } catch (error: any) {
    console.error('Error checking Stripe Connect status:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to check account status',
    })
  }
})

/**
 * POST /api/stripe/connect/dashboard
 * Get Stripe Express Dashboard login link for user
 */
router.post('/connect/dashboard', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!stripe) {
      return res.status(500).json({
        success: false,
        error: 'Stripe is not configured',
      })
    }

    // Get authenticated user using getAuth helper to avoid deprecation warnings
    const auth = getAuth(req)
    const userId = auth?.userId
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      })
    }

    const user = await getOrSyncUser(userId)
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      })
    }

    const accountId = (user as any).stripe_account_id
    if (!accountId) {
      return res.status(400).json({
        success: false,
        error: 'Stripe account not connected. Please complete onboarding first.',
      })
    }

    const { origin } = req.body

    // Create login link for Stripe Express Dashboard
    const loginLink = await stripe.accounts.createLoginLink(accountId)

    res.json({
      success: true,
      data: {
        url: loginLink.url,
      },
    })
  } catch (error: any) {
    console.error('Error creating Stripe dashboard link:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create dashboard link',
    })
  }
})

/**
 * POST /api/stripe/connect/payout
 * Initiate a payout to user's bank account
 */
router.post('/connect/payout', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!stripe) {
      return res.status(500).json({
        success: false,
        error: 'Stripe is not configured',
      })
    }

    // Get authenticated user using getAuth helper to avoid deprecation warnings
    const auth = getAuth(req)
    const userId = auth?.userId
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      })
    }

    const user = await getOrSyncUser(userId)
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      })
    }

    const accountId = (user as any).stripe_account_id
    if (!accountId) {
      return res.status(400).json({
        success: false,
        error: 'Stripe account not connected. Please complete onboarding first.',
      })
    }

    const { amount } = req.body

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payout amount',
      })
    }

    // Create payout
    const payout = await stripe.payouts.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
    }, {
      stripeAccount: accountId,
    })

    res.json({
      success: true,
      data: {
        id: payout.id,
        amount: payout.amount / 100,
        status: payout.status,
      },
    })
  } catch (error: any) {
    console.error('Error initiating payout:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to initiate payout',
    })
  }
})

export default router
