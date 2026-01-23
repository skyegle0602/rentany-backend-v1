"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const clerk_1 = require("../middleware/clerk");
const userSync_1 = require("../services/userSync");
const router = (0, express_1.Router)();
/**
 * GET /api/users/me
 * Get current authenticated user's profile
 * Automatically syncs from Clerk if user doesn't exist in MongoDB
 */
router.get('/me', clerk_1.requireAuth, async (req, res) => {
    try {
        // Use req.auth() as a function (new Clerk API) or req.auth property (fallback)
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
        // Get or sync user from Clerk to MongoDB
        let user;
        try {
            user = await (0, userSync_1.getOrSyncUser)(userId);
        }
        catch (dbError) {
            if (dbError.message === 'Database connection not established') {
                return res.status(503).json({
                    success: false,
                    error: 'Database is not available. Please try again in a moment.',
                    retryAfter: 5,
                });
            }
            throw dbError;
        }
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
            });
        }
        res.json({
            success: true,
            data: (0, userSync_1.formatUserForAPI)(user),
        });
    }
    catch (error) {
        console.error('Error in GET /api/users/me:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});
/**
 * PUT /api/users/me
 * Update current user's profile
 * Updates app-specific fields (not synced from Clerk)
 */
router.put('/me', clerk_1.requireAuth, async (req, res) => {
    try {
        // Use req.auth() as a function (new Clerk API) or req.auth property (fallback)
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
        // Extract only updatable fields (exclude Clerk-managed fields)
        const { username, bio, preferred_language, notification_preferences, push_subscription, documents, stripe_account_id, payouts_enabled, profile_picture, } = req.body;
        const updateData = {};
        if (username !== undefined) {
            // Validate username format
            if (username && (username.length < 3 || username.length > 20)) {
                return res.status(400).json({
                    success: false,
                    error: 'Username must be between 3 and 20 characters',
                });
            }
            if (username && !/^[a-zA-Z0-9_]+$/.test(username)) {
                return res.status(400).json({
                    success: false,
                    error: 'Username can only contain letters, numbers, and underscores',
                });
            }
            updateData.username = username ? username.toLowerCase().trim() : username;
        }
        if (bio !== undefined)
            updateData.bio = bio;
        if (preferred_language !== undefined)
            updateData.preferred_language = preferred_language;
        if (notification_preferences !== undefined)
            updateData.notification_preferences = notification_preferences;
        if (push_subscription !== undefined)
            updateData.push_subscription = push_subscription;
        if (documents !== undefined)
            updateData.documents = documents;
        if (stripe_account_id !== undefined)
            updateData.stripe_account_id = stripe_account_id;
        if (payouts_enabled !== undefined)
            updateData.payouts_enabled = payouts_enabled;
        if (profile_picture !== undefined)
            updateData.profile_picture = profile_picture;
        // Check if there's anything to update
        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No valid fields to update',
            });
        }
        // Update user in MongoDB
        let user;
        try {
            user = await (0, userSync_1.updateUser)(userId, updateData);
        }
        catch (dbError) {
            // Handle duplicate username error
            if (dbError.code === 11000 || dbError.message?.includes('duplicate') || dbError.message?.includes('E11000')) {
                const duplicateField = dbError.keyPattern ? Object.keys(dbError.keyPattern)[0] : 'field';
                if (duplicateField === 'username') {
                    return res.status(409).json({
                        success: false,
                        error: 'This username is already taken. Please choose another one.',
                    });
                }
                return res.status(409).json({
                    success: false,
                    error: `${duplicateField} already exists`,
                });
            }
            throw dbError;
        }
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
            });
        }
        res.json({
            success: true,
            data: (0, userSync_1.formatUserForAPI)(user),
        });
    }
    catch (error) {
        console.error('Error in PUT /api/users/me:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});
/**
 * GET /api/users/by-email
 * Get user by email address
 * Query parameter: ?email=user@example.com
 */
router.get('/by-email', clerk_1.requireAuth, async (req, res) => {
    try {
        const email = req.query.email;
        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'Email parameter is required',
            });
        }
        const user = await (0, userSync_1.getUserByEmail)(email);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
            });
        }
        res.json({
            success: true,
            data: (0, userSync_1.formatUserForAPI)(user),
        });
    }
    catch (error) {
        console.error('Error in GET /api/users/by-email:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});
/**
 * POST /api/users/sync
 * Manually sync current user from Clerk to MongoDB
 * Useful for forcing a refresh of Clerk data
 */
router.post('/sync', clerk_1.requireAuth, async (req, res) => {
    try {
        // Use req.auth() as a function (new Clerk API) or req.auth property (fallback)
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
        // Force sync from Clerk (even if user exists in MongoDB)
        const user = await (0, userSync_1.syncUserFromClerk)(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Failed to sync user from Clerk',
            });
        }
        res.json({
            success: true,
            data: (0, userSync_1.formatUserForAPI)(user),
            message: 'User synced from Clerk successfully',
        });
    }
    catch (error) {
        console.error('Error in POST /api/users/sync:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});
/**
 * POST /api/users/reset-my-verification
 * Reset current user's verification_status to 'unverified'
 * Useful for fixing users who were incorrectly marked as verified from Clerk email verification
 */
router.post('/reset-my-verification', clerk_1.requireAuth, async (req, res) => {
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
        // Reset current user's verification_status to 'unverified'
        const user = await (0, userSync_1.updateUser)(userId, {
            verification_status: 'unverified',
        });
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
            });
        }
        console.log(`🔄 Reset verification status for user ${userId}`);
        res.json({
            success: true,
            message: 'Verification status reset to unverified',
            data: (0, userSync_1.formatUserForAPI)(user),
        });
    }
    catch (error) {
        console.error('Error resetting verification status:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});
exports.default = router;
//# sourceMappingURL=users.js.map