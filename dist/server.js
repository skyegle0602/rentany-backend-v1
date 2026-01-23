"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const path_1 = __importDefault(require("path"));
const clerk_1 = require("./middleware/clerk");
const database_1 = require("./config/database");
const env_1 = require("./config/env");
const app = (0, express_1.default)();
// Security middleware - configure helmet to allow CORS for static files
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin requests for static files
    crossOriginEmbedderPolicy: false, // Disable to allow images to load
}));
// CORS configuration
app.use((0, cors_1.default)({
    origin: env_1.FRONTEND_URL,
    credentials: true, // Allow cookies to be sent
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    // Note: For file uploads with FormData, browser sets Content-Type with boundary, which is allowed
}));
// Import route handlers (needed early for Stripe webhook)
const webhooks_1 = __importDefault(require("./routes/webhooks"));
const stripe_1 = __importDefault(require("./routes/stripe"));
// Stripe webhook needs raw body for signature verification
// Mount webhook routes BEFORE JSON parsing middleware and authentication
// These routes are PUBLIC (no auth required) - Stripe sends webhooks without authentication
app.use('/api/webhooks/stripe', express_1.default.raw({ type: 'application/json' }), webhooks_1.default);
// Handle /api/stripe/webhook route directly (before auth middleware)
// This route must be PUBLIC - Stripe sends webhooks without authentication
app.post('/api/stripe/webhook', express_1.default.raw({ type: 'application/json' }), (req, res, next) => {
    console.log('🔔 ===== /api/stripe/webhook ROUTE HIT (BEFORE AUTH) =====');
    console.log('📥 Request received at:', new Date().toISOString());
    console.log('📍 Original URL:', req.url);
    console.log('📍 Request path:', req.path);
    // Modify the URL to match the router's route pattern
    const originalUrl = req.url;
    const originalPath = req.path;
    req.url = '/webhook';
    // Note: req.path is read-only, but req.url modification should work
    console.log('🔄 Forwarding to stripeRouter with URL:', req.url);
    // Call the stripeRouter, which has the /webhook route handler
    // This should handle the request and send a response
    (0, stripe_1.default)(req, res, (err) => {
        // Restore original URL
        req.url = originalUrl;
        if (err) {
            console.error('❌ Error in stripeRouter:', err);
            // Send error response instead of calling next() to avoid auth middleware
            return res.status(500).json({
                success: false,
                error: 'Error processing webhook',
            });
        }
        // If router didn't handle it, send a response to prevent auth middleware from running
        if (!res.headersSent) {
            console.warn('⚠️  stripeRouter did not send a response');
            return res.status(404).json({
                success: false,
                error: 'Webhook route not found in router',
            });
        }
    });
});
// Body parsing middleware (for all other routes)
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Serve uploaded files statically with CORS headers
// IMPORTANT: This must be BEFORE authentication middleware to allow public access
// In production, use a CDN or cloud storage instead
app.use('/uploads', (0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow requests from frontend URL or no origin (direct requests)
        if (!origin || origin === env_1.FRONTEND_URL || origin.startsWith(env_1.FRONTEND_URL)) {
            callback(null, true);
        }
        else {
            callback(null, true); // Allow all origins for now (can restrict in production)
        }
    },
    credentials: true,
    methods: ['GET', 'OPTIONS', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Range'],
    exposedHeaders: ['Content-Length', 'Content-Type', 'Accept-Ranges'],
    maxAge: 86400, // 24 hours
}), express_1.default.static(path_1.default.join(process.cwd(), 'uploads'), {
    // Add cache control headers
    maxAge: '1d',
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
        // Ensure CORS headers are explicitly set for all static file responses
        res.setHeader('Access-Control-Allow-Origin', env_1.FRONTEND_URL || '*');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, HEAD');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Range');
        res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Type, Accept-Ranges');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    },
}));
// Clerk authentication middleware
// This must be applied before routes to extract user data
app.use(clerk_1.clerkAuth);
// Health check endpoint (public)
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString(),
    });
});
// API routes
// Apply public routes middleware to all API routes
app.use('/api', clerk_1.publicRoutes);
// Import other route handlers
const users_1 = __importDefault(require("./routes/users"));
// Note: stripeRouter is already imported above for webhook route
const verification_1 = __importDefault(require("./routes/verification"));
// @ts-ignore - TypeScript cache issue, file exists and exports correctly
const reviews_1 = __importDefault(require("./routes/reviews"));
const items_1 = __importDefault(require("./routes/items"));
const files_1 = __importDefault(require("./routes/files"));
const itemAvailability_1 = __importDefault(require("./routes/itemAvailability"));
const favorites_1 = __importDefault(require("./routes/favorites"));
const viewedItems_1 = __importDefault(require("./routes/viewedItems"));
const wallet_1 = __importDefault(require("./routes/wallet"));
const payouts_1 = __importDefault(require("./routes/payouts"));
const rentalRequests_1 = __importDefault(require("./routes/rentalRequests"));
const disputes_1 = __importDefault(require("./routes/disputes"));
// Mount route handlers
app.use('/api/users', users_1.default);
app.use('/api/stripe', stripe_1.default);
app.use('/api/webhooks', webhooks_1.default); // Webhooks don't need auth middleware (already imported above)
app.use('/api/verification', verification_1.default);
app.use('/api/reviews', reviews_1.default);
app.use('/api/items', items_1.default);
app.use('/api/file', files_1.default);
app.use('/api/item-availability', itemAvailability_1.default);
app.use('/api/favorites', favorites_1.default);
app.use('/api/viewed-items', viewedItems_1.default);
app.use('/api/wallet', wallet_1.default);
app.use('/api/payouts', payouts_1.default);
app.use('/api/rental-requests', rentalRequests_1.default);
app.use('/api/disputes', disputes_1.default);
// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route not found',
    });
});
// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        success: false,
        error: err.message || 'Internal server error',
    });
});
// Start server and connect to database
async function startServer() {
    try {
        // Connect to MongoDB Atlas
        console.log("Starting server and connecting to database");
        await (0, database_1.connectDatabase)();
        // Start Express server
        app.listen(env_1.PORT, () => {
            console.log(`🚀 Server is running on port ${env_1.PORT}`);
            console.log(`📡 API endpoint: http://localhost:${env_1.PORT}/api`);
            console.log(`🔐 Clerk Secret Key: ${env_1.CLERK_SECRET_KEY ? 'Set ✅' : 'Missing ❌'}`);
            console.log(`🔑 Clerk Publishable Key: ${env_1.CLERK_PUBLISHABLE_KEY ? 'Set ✅' : 'Missing ❌'}`);
            console.log(`💳 Stripe Secret Key: ${env_1.STRIPE_SECRET_KEY ? 'Set ✅' : 'Missing ❌'}`);
            console.log(`💳 Stripe Publishable Key: ${env_1.STRIPE_PUBLISHABLE_KEY ? 'Set ✅' : 'Missing ❌'}`);
            console.log(`🗄️  MongoDB URI: ${env_1.MONGODB_URI ? 'Set ✅' : 'Missing ❌'}`);
            if (!env_1.CLERK_SECRET_KEY || !env_1.CLERK_PUBLISHABLE_KEY) {
                console.warn('⚠️  Warning: Clerk keys are missing. Authentication will not work properly.');
                console.warn('   Get your keys from: https://dashboard.clerk.com/last-active?path=api-keys');
            }
            if (!env_1.STRIPE_SECRET_KEY || !env_1.STRIPE_PUBLISHABLE_KEY) {
                console.warn('⚠️  Warning: Stripe keys are missing. Payment features will not work.');
                console.warn('   Get your keys from: https://dashboard.stripe.com/apikeys');
            }
            if (!env_1.MONGODB_URI) {
                console.warn('⚠️  Warning: MongoDB URI is missing. Database features will not work.');
                console.warn('   Add MONGODB_URI to your .env file with your MongoDB Atlas connection string');
            }
        });
    }
    catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}
// Handle graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');
    const { disconnectDatabase } = await Promise.resolve().then(() => __importStar(require('./config/database')));
    await disconnectDatabase();
    process.exit(0);
});
process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully...');
    const { disconnectDatabase } = await Promise.resolve().then(() => __importStar(require('./config/database')));
    await disconnectDatabase();
    process.exit(0);
});
startServer();
exports.default = app;
//# sourceMappingURL=server.js.map