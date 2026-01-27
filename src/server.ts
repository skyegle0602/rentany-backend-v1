import express, { Express, Request, Response, NextFunction } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import path from 'path'
import { clerkAuth, publicRoutes } from './middleware/clerk'
import { connectDatabase } from './config/database'
import { PORT, FRONTEND_URL, ALLOWED_ORIGINS, CLERK_SECRET_KEY, CLERK_PUBLISHABLE_KEY, STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, MONGODB_URI } from './config/env'

const app: Express = express()

// Security middleware - configure helmet to allow CORS for static files
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin requests for static files
  crossOriginEmbedderPolicy: false, // Disable to allow images to load
}))

// CORS configuration
// Supports multiple origins for both localhost (development) and production
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true)
    }
    
    // Normalize origin by removing trailing slashes for comparison
    const normalizedOrigin = origin.replace(/\/+$/, '').toLowerCase()
    
    // Check against all allowed origins
    for (const allowedOrigin of ALLOWED_ORIGINS) {
      const normalizedAllowed = allowedOrigin.replace(/\/+$/, '').toLowerCase()
      
      // Exact match
      if (normalizedOrigin === normalizedAllowed) {
        return callback(null, true)
      }
      
      // Check if origin starts with allowed origin (for subdomains)
      if (normalizedOrigin.startsWith(normalizedAllowed)) {
        return callback(null, true)
      }
    }
    
    // In development, also allow localhost with any port
    if (process.env.NODE_ENV !== 'production' && normalizedOrigin.includes('localhost')) {
      return callback(null, true)
    }
    
    // Reject other origins
    console.warn(`⚠️  CORS blocked origin: ${origin}`)
    console.warn(`   Allowed origins: ${ALLOWED_ORIGINS.join(', ')}`)
    callback(new Error('Not allowed by CORS'))
  },
  credentials: true, // Allow cookies to be sent
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  // Note: For file uploads with FormData, browser sets Content-Type with boundary, which is allowed
}))

// Import route handlers (needed early for Stripe webhook)
import webhooksRouter from './routes/webhooks'
import stripeRouter from './routes/stripe'

// Stripe webhook needs raw body for signature verification
// Mount webhook routes BEFORE JSON parsing middleware and authentication
// These routes are PUBLIC (no auth required) - Stripe sends webhooks without authentication
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }), webhooksRouter)

// Handle /api/stripe/webhook route directly (before auth middleware)
// This route must be PUBLIC - Stripe sends webhooks without authentication
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), (req, res, next) => {
  console.log('🔔 ===== /api/stripe/webhook ROUTE HIT (BEFORE AUTH) =====')
  console.log('📥 Request received at:', new Date().toISOString())
  console.log('📍 Original URL:', req.url)
  console.log('📍 Request path:', req.path)
  
  // Modify the URL to match the router's route pattern
  const originalUrl = req.url
  const originalPath = req.path
  req.url = '/webhook'
  // Note: req.path is read-only, but req.url modification should work
  
  console.log('🔄 Forwarding to stripeRouter with URL:', req.url)
  
  // Call the stripeRouter, which has the /webhook route handler
  // This should handle the request and send a response
  stripeRouter(req, res, (err?: any) => {
    // Restore original URL
    req.url = originalUrl
    
    if (err) {
      console.error('❌ Error in stripeRouter:', err)
      // Send error response instead of calling next() to avoid auth middleware
      return res.status(500).json({
        success: false,
        error: 'Error processing webhook',
      })
    }
    
    // If router didn't handle it, send a response to prevent auth middleware from running
    if (!res.headersSent) {
      console.warn('⚠️  stripeRouter did not send a response')
      return res.status(404).json({
        success: false,
        error: 'Webhook route not found in router',
      })
    }
  })
})

// Body parsing middleware (for all other routes)
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Serve uploaded files statically with CORS headers
// NOTE: This is now disabled as files are served from AWS S3
// Keeping this commented for backward compatibility with old local files if needed
// Files are now uploaded to S3 bucket 'rentany-uploads' via /api/file/upload endpoint
/*
app.use('/uploads', cors({
  origin: (origin, callback) => {
    // Allow requests from frontend URL or no origin (direct requests)
    if (!origin || origin === FRONTEND_URL || origin.startsWith(FRONTEND_URL)) {
      callback(null, true)
    } else {
      callback(null, true) // Allow all origins for now (can restrict in production)
    }
  },
  credentials: true,
  methods: ['GET', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Range'],
  exposedHeaders: ['Content-Length', 'Content-Type', 'Accept-Ranges'],
  maxAge: 86400, // 24 hours
}), express.static(path.join(process.cwd(), 'uploads'), {
  // Add cache control headers
  maxAge: '1d',
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    // Ensure CORS headers are explicitly set for all static file responses
    res.setHeader('Access-Control-Allow-Origin', FRONTEND_URL || '*')
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, HEAD')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Range')
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Type, Accept-Ranges')
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
  },
}))
*/

// Clerk authentication middleware
// This must be applied before routes to extract user data
app.use(clerkAuth)

// Health check endpoint (public)
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  })
})

// API routes
// Apply public routes middleware to all API routes
app.use('/api', publicRoutes)

// Import other route handlers
import usersRouter from './routes/users'
// Note: stripeRouter is already imported above for webhook route
// @ts-ignore - TypeScript cache issue, file exists and exports correctly
import reviewsRouter from './routes/reviews'
import itemsRouter from './routes/items'
import filesRouter from './routes/files'
import itemAvailabilityRouter from './routes/itemAvailability'
import favoritesRouter from './routes/favorites'
import viewedItemsRouter from './routes/viewedItems'
import walletRouter from './routes/wallet'
import payoutsRouter from './routes/payouts'
import rentalRequestsRouter from './routes/rentalRequests'
import disputesRouter from './routes/disputes'

// Mount route handlers
app.use('/api/users', usersRouter)
app.use('/api/stripe', stripeRouter)
app.use('/api/webhooks', webhooksRouter) // Webhooks don't need auth middleware (already imported above)
app.use('/api/reviews', reviewsRouter)
app.use('/api/items', itemsRouter)
app.use('/api/file', filesRouter)
app.use('/api/item-availability', itemAvailabilityRouter)
app.use('/api/favorites', favoritesRouter)
app.use('/api/viewed-items', viewedItemsRouter)
app.use('/api/wallet', walletRouter)
app.use('/api/payouts', payoutsRouter)
app.use('/api/rental-requests', rentalRequestsRouter)
app.use('/api/disputes', disputesRouter)

// 404 handler
app.use((req: Request, res: Response) => {
  console.warn(`⚠️  404 - Route not found: ${req.method} ${req.originalUrl || req.url}`)
  console.warn(`   Path: ${req.path}`)
  console.warn(`   Query:`, req.query)
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.originalUrl || req.url,
    method: req.method,
  })
})

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err)
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error',
  })
})

// Start server and connect to database
async function startServer() {
  try {
    // Connect to MongoDB Atlas
    console.log("Starting server and connecting to database")
    await connectDatabase()
    
    // Start Express server
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`)
      console.log(`📡 API endpoint: http://localhost:${PORT}/api`)
      console.log(`🔐 Clerk Secret Key: ${CLERK_SECRET_KEY ? 'Set ✅' : 'Missing ❌'}`)
      console.log(`🔑 Clerk Publishable Key: ${CLERK_PUBLISHABLE_KEY ? 'Set ✅' : 'Missing ❌'}`)
      console.log(`💳 Stripe Secret Key: ${STRIPE_SECRET_KEY ? 'Set ✅' : 'Missing ❌'}`)
      console.log(`💳 Stripe Publishable Key: ${STRIPE_PUBLISHABLE_KEY ? 'Set ✅' : 'Missing ❌'}`)
      console.log(`🗄️  MongoDB URI: ${MONGODB_URI ? 'Set ✅' : 'Missing ❌'}`)
      
      if (!CLERK_SECRET_KEY || !CLERK_PUBLISHABLE_KEY) {
        console.warn('⚠️  Warning: Clerk keys are missing. Authentication will not work properly.')
        console.warn('   Get your keys from: https://dashboard.clerk.com/last-active?path=api-keys')
      }
      
      if (!STRIPE_SECRET_KEY || !STRIPE_PUBLISHABLE_KEY) {
        console.warn('⚠️  Warning: Stripe keys are missing. Payment features will not work.')
        console.warn('   Get your keys from: https://dashboard.stripe.com/apikeys')
      }
      
      if (!MONGODB_URI) {
        console.warn('⚠️  Warning: MongoDB URI is missing. Database features will not work.')
        console.warn('   Add MONGODB_URI to your .env file with your MongoDB Atlas connection string')
      }
    })
  } catch (error) {
    console.error('❌ Failed to start server:', error)
    process.exit(1)
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...')
  const { disconnectDatabase } = await import('./config/database')
  await disconnectDatabase()
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...')
  const { disconnectDatabase } = await import('./config/database')
  await disconnectDatabase()
  process.exit(0)
})

startServer()

export default app
