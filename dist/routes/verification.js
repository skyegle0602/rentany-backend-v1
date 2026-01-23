"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const clerk_1 = require("../middleware/clerk");
const stripe_1 = __importDefault(require("stripe"));
const env_1 = require("../config/env");
const userSync_1 = require("../services/userSync");
const router = (0, express_1.Router)();
// Initialize Stripe (will be undefined if key is missing)
let stripe = null;
try {
    if (env_1.STRIPE_SECRET_KEY) {
        stripe = new stripe_1.default(env_1.STRIPE_SECRET_KEY, {
            apiVersion: '2025-12-15.clover',
        });
    }
}
catch (error) {
    console.error('Failed to initialize Stripe:', error);
}
/**
 * POST /api/verification/session
 * Create a Stripe Identity verification session
 * Returns a URL to redirect the user to Stripe's verification flow
 */
router.post('/session', clerk_1.requireAuth, async (req, res) => {
    try {
        // Get authenticated user
        let auth;
        try {
            if (typeof req.auth === 'function') {
                auth = req.auth();
            }
            else {
                auth = req.auth;
            }
        }
        catch {
            auth = req.auth;
        }
        const userId = auth?.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
            });
        }
        // Check if Stripe is configured
        if (!stripe) {
            return res.status(500).json({
                success: false,
                error: 'Stripe is not configured. Please add STRIPE_SECRET_KEY to your .env file',
            });
        }
        // Get user from database
        const user = await (0, userSync_1.getOrSyncUser)(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
            });
        }
        // Create Stripe Identity verification session
        // Using test mode - Stripe Identity will work in test mode with test API keys
        const verificationSession = await stripe.identity.verificationSessions.create({
            type: 'document', // Document verification type
            metadata: {
                user_id: userId,
                user_email: user.email,
            },
            return_url: `${env_1.FRONTEND_URL}/profile?verification=complete`,
            options: {
                document: {
                    // In test mode, you can use test document numbers
                    // For production, remove this to use real documents
                    allowed_types: ['driving_license', 'id_card', 'passport'],
                },
            },
        });
        // Update user verification status to 'pending'
        await (0, userSync_1.updateUser)(userId, {
            verification_status: 'pending',
        });
        console.log(`✅ Created Stripe Identity verification session for user ${userId}`);
        console.log(`   Session ID: ${verificationSession.id}`);
        console.log(`   Status: ${verificationSession.status}`);
        // Return the verification URL
        res.json({
            success: true,
            data: {
                url: verificationSession.url || '',
                session_id: verificationSession.id,
            },
        });
    }
    catch (error) {
        console.error('Error creating verification session:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create verification session',
        });
    }
});
/**
 * GET /api/verification/status
 * Get the current verification status for the authenticated user
 */
router.get('/status', clerk_1.requireAuth, async (req, res) => {
    try {
        // Get authenticated user
        let auth;
        try {
            if (typeof req.auth === 'function') {
                auth = req.auth();
            }
            else {
                auth = req.auth;
            }
        }
        catch {
            auth = req.auth;
        }
        const userId = auth?.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
            });
        }
        // Get user from database
        const user = await (0, userSync_1.getOrSyncUser)(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
            });
        }
        res.json({
            success: true,
            data: {
                verification_status: user.verification_status || 'unverified',
            },
        });
    }
    catch (error) {
        console.error('Error getting verification status:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get verification status',
        });
    }
});
exports.default = router;
//# sourceMappingURL=verification.js.map