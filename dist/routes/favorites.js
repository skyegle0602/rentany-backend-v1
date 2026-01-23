"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const clerk_1 = require("../middleware/clerk");
const favorites_1 = __importDefault(require("../models/favorites"));
const database_1 = require("../config/database");
const userSync_1 = require("../services/userSync");
const router = (0, express_1.Router)();
/**
 * GET /api/favorites
 * Get favorites for a user
 * Query parameters:
 * - user_email: The user's email to get favorites for
 */
router.get('/', async (req, res) => {
    try {
        if (!(0, database_1.isDatabaseConnected)()) {
            return res.status(503).json({
                success: false,
                error: 'Database is not available. Please try again in a moment.',
            });
        }
        const { user_email } = req.query;
        if (!user_email) {
            return res.status(400).json({
                success: false,
                error: 'user_email query parameter is required',
            });
        }
        // Fetch favorites for the user
        const favorites = await favorites_1.default.find({
            user_email: user_email,
        })
            .sort({ created_at: -1 })
            .lean();
        // Format for API response
        const formattedFavorites = favorites.map((fav) => ({
            id: fav._id.toString(),
            user_email: fav.user_email,
            item_id: fav.item_id,
            created_at: fav.created_at?.toISOString() || new Date().toISOString(),
        }));
        res.json({
            success: true,
            data: formattedFavorites,
        });
    }
    catch (error) {
        console.error('Error fetching favorites:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});
/**
 * POST /api/favorites
 * Add an item to favorites
 * Requires authentication
 */
router.post('/', clerk_1.requireAuth, async (req, res) => {
    try {
        if (!(0, database_1.isDatabaseConnected)()) {
            return res.status(503).json({
                success: false,
                error: 'Database is not available. Please try again in a moment.',
            });
        }
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
        const { item_id, user_email } = req.body;
        // Validate required fields
        if (!item_id || !user_email) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: item_id, user_email',
            });
        }
        // Verify user exists
        const user = await (0, userSync_1.getOrSyncUser)(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
            });
        }
        // Verify user_email matches authenticated user
        if (user.email !== user_email) {
            return res.status(403).json({
                success: false,
                error: 'Cannot add favorites for other users',
            });
        }
        // Check if favorite already exists
        const existingFavorite = await favorites_1.default.findOne({
            user_email,
            item_id,
        });
        if (existingFavorite) {
            // Return existing favorite
            return res.json({
                success: true,
                data: {
                    id: existingFavorite._id.toString(),
                    user_email: existingFavorite.user_email,
                    item_id: existingFavorite.item_id,
                    created_at: existingFavorite.created_at?.toISOString() || new Date().toISOString(),
                },
            });
        }
        // Create new favorite
        const favorite = new favorites_1.default({
            user_email,
            item_id,
        });
        await favorite.save();
        console.log(`✅ Added favorite: item ${item_id} for user ${user_email}`);
        // Format for API response
        const formattedFavorite = {
            id: favorite._id.toString(),
            user_email: favorite.user_email,
            item_id: favorite.item_id,
            created_at: favorite.created_at?.toISOString() || new Date().toISOString(),
        };
        res.json({
            success: true,
            data: formattedFavorite,
        });
    }
    catch (error) {
        console.error('Error creating favorite:', error);
        // Handle duplicate key error (unique constraint)
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                error: 'Item is already in favorites',
            });
        }
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});
/**
 * DELETE /api/favorites
 * Remove an item from favorites by item_id and user_email
 * Requires authentication
 * Body: { item_id: string, user_email: string }
 */
router.delete('/', clerk_1.requireAuth, async (req, res) => {
    try {
        if (!(0, database_1.isDatabaseConnected)()) {
            return res.status(503).json({
                success: false,
                error: 'Database is not available. Please try again in a moment.',
            });
        }
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
        const { item_id, user_email } = req.body;
        if (!item_id || !user_email) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: item_id, user_email',
            });
        }
        // Verify user owns this favorite
        const user = await (0, userSync_1.getOrSyncUser)(userId);
        if (!user || user.email !== user_email) {
            return res.status(403).json({
                success: false,
                error: 'Cannot delete favorites for other users',
            });
        }
        // Find and delete the favorite
        const favorite = await favorites_1.default.findOneAndDelete({
            user_email,
            item_id,
        });
        // If favorite doesn't exist, that's okay - it's already deleted (idempotent operation)
        if (!favorite) {
            console.log(`ℹ️  Favorite for item ${item_id} by user ${user_email} was already deleted or doesn't exist`);
            return res.json({
                success: true,
                message: 'Favorite was already deleted or does not exist',
            });
        }
        console.log(`✅ Removed favorite for item ${item_id} by user ${user_email}`);
        res.json({
            success: true,
        });
    }
    catch (error) {
        console.error('Error deleting favorite:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});
/**
 * DELETE /api/favorites/:id
 * Remove an item from favorites by ID
 * Requires authentication
 */
router.delete('/:id', clerk_1.requireAuth, async (req, res) => {
    try {
        if (!(0, database_1.isDatabaseConnected)()) {
            return res.status(503).json({
                success: false,
                error: 'Database is not available. Please try again in a moment.',
            });
        }
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
        const { id } = req.params;
        // Find the favorite
        const favorite = await favorites_1.default.findById(id).lean();
        // If favorite doesn't exist, that's okay - it's already deleted (idempotent operation)
        if (!favorite) {
            console.log(`ℹ️  Favorite ${id} was already deleted or doesn't exist`);
            return res.json({
                success: true,
                message: 'Favorite was already deleted or does not exist',
            });
        }
        // Verify user owns this favorite
        const user = await (0, userSync_1.getOrSyncUser)(userId);
        if (!user || user.email !== favorite.user_email) {
            return res.status(403).json({
                success: false,
                error: 'Cannot delete favorites for other users',
            });
        }
        // Delete the favorite
        await favorites_1.default.findByIdAndDelete(id);
        console.log(`✅ Removed favorite ${id} by user ${userId}`);
        res.json({
            success: true,
        });
    }
    catch (error) {
        console.error('Error deleting favorite:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});
exports.default = router;
//# sourceMappingURL=favorites.js.map