import { Router, Request, Response } from 'express'
import { Webhook } from 'svix'
import { syncUserFromClerk } from '../services/userSync'
import { CLERK_WEBHOOK_SECRET, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } from '../config/env'
import { isDatabaseConnected } from '../config/database'
import Stripe from 'stripe'

const router = Router()

// Initialize Stripe (will be undefined if key is missing)
let stripe: Stripe | null = null
try {
  if (STRIPE_SECRET_KEY) {
    stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2025-12-15.clover',
    })
    console.log('✅ Stripe initialized for webhooks')
  } else {
    console.warn('⚠️  STRIPE_SECRET_KEY not found, Stripe webhooks will not work')
  }
} catch (error) {
  console.error('❌ Failed to initialize Stripe:', error)
}

/**
 * POST /api/webhooks/clerk
 * Clerk webhook endpoint for user events
 * Automatically syncs user data to MongoDB when users are created/updated in Clerk
 * 
 * To set up:
 * 1. Go to Clerk Dashboard -> Webhooks
 * 2. Add endpoint: https://your-domain.com/api/webhooks/clerk
 * 3. Select events: user.created, user.updated, user.deleted
 * 4. Copy the webhook signing secret to CLERK_WEBHOOK_SECRET in .env
 */
router.post('/clerk', async (req: Request, res: Response) => {
  const WEBHOOK_SECRET = CLERK_WEBHOOK_SECRET

  if (!WEBHOOK_SECRET) {
    console.error('❌ CLERK_WEBHOOK_SECRET is missing')
    return res.status(500).json({
      success: false,
      error: 'Webhook secret not configured',
    })
  }

  // Get the Svix headers for verification
  const svix_id = req.headers['svix-id'] as string
  const svix_timestamp = req.headers['svix-timestamp'] as string
  const svix_signature = req.headers['svix-signature'] as string

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return res.status(400).json({
      success: false,
      error: 'Error occurred -- no svix headers',
    })
  }

  // Get the body
  const payload = JSON.stringify(req.body)

  // Create a new Svix instance with your secret
  const wh = new Webhook(WEBHOOK_SECRET)

  let evt: any

  // Verify the payload with the headers
  try {
    evt = wh.verify(payload, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as any
  } catch (err) {
    console.error('Error verifying webhook:', err)
    return res.status(400).json({
      success: false,
      error: 'Error occurred -- webhook verification failed',
    })
  }

  // Handle the webhook
  const eventType = evt.type
  const { id, email_addresses, username, first_name, last_name, image_url, created_at, updated_at } = evt.data

  console.log(`📥 Clerk webhook received: ${eventType} for user ${id}`)

  try {
    switch (eventType) {
      case 'user.created':
      case 'user.updated':
        // Sync user to MongoDB
        await syncUserFromClerk(id)
        console.log(`✅ Synced user ${id} to MongoDB (${eventType})`)
        break

      case 'user.deleted':
        // Optionally handle user deletion
        // For now, we'll keep the user in MongoDB but mark as deleted
        // You can implement soft delete or hard delete based on your needs
        console.log(`⚠️  User ${id} deleted in Clerk (keeping in MongoDB for now)`)
        break

      default:
        console.log(`ℹ️  Unhandled webhook event type: ${eventType}`)
    }

    res.json({
      success: true,
      message: 'Webhook processed successfully',
    })
  } catch (error) {
    console.error('Error processing webhook:', error)
    res.status(500).json({
      success: false,
      error: 'Error processing webhook',
    })
  }
})

/**
 * POST /api/webhooks/stripe
 * Stripe webhook endpoint
 * 
 * Note: Stripe Identity verification has been removed
 * Add other Stripe event handlers here as needed
 * 
 * To set up:
 * 1. Go to Stripe Dashboard -> Developers -> Webhooks
 * 2. Add endpoint: https://your-domain.com/api/webhooks/stripe
 * 3. Select events you want to handle
 * 4. Copy the webhook signing secret (starts with whsec_) to STRIPE_WEBHOOK_SECRET in .env
 */
router.post('/stripe', async (req: Request, res: Response) => {
  console.log('🔔 ===== STRIPE WEBHOOK RECEIVED =====')
  console.log('📥 Request received at:', new Date().toISOString())
  console.log('📍 Path:', req.path)
  console.log('🌐 Method:', req.method)

  const WEBHOOK_SECRET = STRIPE_WEBHOOK_SECRET

  if (!WEBHOOK_SECRET) {
    console.error('❌ STRIPE_WEBHOOK_SECRET is missing from environment variables')
    return res.status(500).json({
      success: false,
      error: 'Webhook secret not configured',
    })
  }

  if (!stripe) {
    console.error('❌ Stripe is not initialized')
    return res.status(500).json({
      success: false,
      error: 'Stripe is not configured',
    })
  }

  // Get the Stripe signature from headers
  const sig = req.headers['stripe-signature'] as string

  if (!sig) {
    console.error('❌ Missing stripe-signature header')
    return res.status(400).json({
      success: false,
      error: 'Missing stripe-signature header',
    })
  }

  let event: Stripe.Event

  // Verify the webhook signature
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      WEBHOOK_SECRET
    )
    console.log('✅ Webhook signature verified successfully!')
    console.log('📊 Event type:', event.type)
    console.log('🆔 Event ID:', event.id)
  } catch (err: any) {
    console.error('❌ Webhook signature verification FAILED!')
    console.error('   Error:', err.message)
    return res.status(400).json({
      success: false,
      error: `Webhook signature verification failed: ${err.message}`,
    })
  }

  console.log(`📥 Stripe webhook event received: ${event.type}`)
  console.log(`📥 Event type (raw):`, JSON.stringify(event.type))
  console.log(`📥 Event type (typeof):`, typeof event.type)

  try {
    // Check database connection
    if (!isDatabaseConnected()) {
      console.error('❌ Database is not connected. Cannot process webhook.')
      return res.status(503).json({
        success: false,
        error: 'Database is not available',
      })
    }

    // Handle Stripe webhook events
    const User = (await import('../models/users')).default
    const { updateUser } = await import('../services/userSync')

    // Use switch statement for cleaner event handling
    console.log(`🔍 Processing event type: "${event.type}"`)
    console.log(`🔍 About to enter switch statement...`)
    
    // Explicit check before switch
    if (event.type === 'setup_intent.succeeded') {
      console.log(`✅ MATCHED: setup_intent.succeeded via if statement`)
    }
    
    switch (event.type) {
      case 'account.updated': {
        const account = event.data.object as Stripe.Account
        console.log('📋 Account updated event:', {
          id: account.id,
          details_submitted: account.details_submitted,
          payouts_enabled: account.payouts_enabled,
        })

        // Find user by stripe_account_id
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
              verification_status: 'unverified',
            } as any)
            console.log(`ℹ️  User ${user.clerk_id} account not fully connected yet`)
          }
        } else {
          console.warn(`⚠️  No user found with stripe_account_id: ${account.id}`)
        }
        break
      }

      case 'setup_intent.succeeded': {
        const setupIntent = event.data.object as Stripe.SetupIntent
        console.log('💳 ===== SETUP INTENT SUCCEEDED EVENT =====')
        console.log('📋 Setup Intent Details:', {
          id: setupIntent.id,
          customer: setupIntent.customer,
          payment_method: setupIntent.payment_method,
          status: setupIntent.status,
        })

        // Extract customer ID
        if (!setupIntent.customer) {
          console.warn(`⚠️  Setup intent has no customer field - skipping`)
          break
        }

        if (!setupIntent.payment_method) {
          console.warn(`⚠️  Setup intent has no payment_method field - skipping`)
          break
        }

        const customerId = typeof setupIntent.customer === 'string' 
          ? setupIntent.customer 
          : (setupIntent.customer as Stripe.Customer).id

        const paymentMethodId = typeof setupIntent.payment_method === 'string' 
          ? setupIntent.payment_method 
          : (setupIntent.payment_method as Stripe.PaymentMethod).id

        console.log(`🔍 Looking up user with stripe_customer_id: ${customerId}`)
        console.log(`💳 Payment method ID to save: ${paymentMethodId}`)

        // Find user by stripe_customer_id
        const user = await User.findOne({ stripe_customer_id: customerId })

        if (!user) {
          console.error(`❌ No user found with stripe_customer_id: ${customerId}`)
          // Log all users with customer IDs for debugging
          const allUsers = await User.find({ stripe_customer_id: { $exists: true } })
          console.log(`   Found ${allUsers.length} users with stripe_customer_id:`)
          allUsers.forEach(u => {
            console.log(`     - ${u.email}: ${(u as any).stripe_customer_id}`)
          })
          break
        }

        console.log(`✅ Found user: ${user.email} (clerk_id: ${user.clerk_id})`)

        // THIS IS THE CRITICAL PART - Save payment method ID to database
        try {
          const updatedUser = await updateUser(user.clerk_id, {
            stripe_payment_method_id: paymentMethodId,
          } as any)

          if (updatedUser) {
            console.log(`✅ SUCCESS: Saved payment method ${paymentMethodId} to database`)
            console.log(`   User: ${user.email}`)
            console.log(`   Payment Method ID: ${(updatedUser as any).stripe_payment_method_id}`)
            console.log(`   Customer ID: ${(updatedUser as any).stripe_customer_id}`)
          } else {
            console.error(`❌ FAILED: updateUser returned null for user ${user.clerk_id}`)
          }
        } catch (updateError: any) {
          console.error(`❌ ERROR saving payment method:`, updateError)
          console.error(`   Message:`, updateError.message)
          console.error(`   Stack:`, updateError.stack)
        }
        break
      }

      case 'payment_method.attached': {
        const paymentMethod = event.data.object as Stripe.PaymentMethod
        console.log('💳 ===== PAYMENT METHOD ATTACHED EVENT =====')
        console.log('📋 Payment Method Details:', {
          id: paymentMethod.id,
          customer: paymentMethod.customer,
          type: paymentMethod.type,
        })

        if (!paymentMethod.customer) {
          console.warn(`⚠️  Payment method has no customer field - skipping`)
          break
        }

        const customerId = typeof paymentMethod.customer === 'string' 
          ? paymentMethod.customer 
          : (paymentMethod.customer as Stripe.Customer).id

        console.log(`🔍 Looking up user with stripe_customer_id: ${customerId}`)

        // Find user by stripe_customer_id
        const user = await User.findOne({ stripe_customer_id: customerId })

        if (!user) {
          console.error(`❌ No user found with stripe_customer_id: ${customerId}`)
          break
        }

        console.log(`✅ Found user: ${user.email} (clerk_id: ${user.clerk_id})`)

        // THIS IS THE CRITICAL PART - Save payment method ID to database
        try {
          const updatedUser = await updateUser(user.clerk_id, {
            stripe_payment_method_id: paymentMethod.id,
          } as any)

          if (updatedUser) {
            console.log(`✅ SUCCESS: Saved payment method ${paymentMethod.id} to database`)
            console.log(`   User: ${user.email}`)
            console.log(`   Payment Method ID: ${(updatedUser as any).stripe_payment_method_id}`)
          } else {
            console.error(`❌ FAILED: updateUser returned null for user ${user.clerk_id}`)
          }
        } catch (updateError: any) {
          console.error(`❌ ERROR saving payment method:`, updateError)
          console.error(`   Message:`, updateError.message)
          console.error(`   Stack:`, updateError.stack)
        }
        break
      }

      default:
        console.log(`ℹ️  Unhandled Stripe event type: ${event.type}`)
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

export default router
