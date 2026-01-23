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
const express_1 = require("express");
const clerk_1 = require("../middleware/clerk");
const itemAvailability_1 = __importDefault(require("../models/itemAvailability"));
const database_1 = require("../config/database");
const userSync_1 = require("../services/userSync");
const router = (0, express_1.Router)();
/**
 * GET /api/item-availability
 * Get blocked date ranges for an item
 * Query parameters:
 * - item_id: The item ID to get availability for
 */
router.get('/', async (req, res) => {
    try {
        if (!(0, database_1.isDatabaseConnected)()) {
            return res.status(503).json({
                success: false,
                error: 'Database is not available. Please try again in a moment.',
            });
        }
        const { item_id } = req.query;
        if (!item_id) {
            return res.status(400).json({
                success: false,
                error: 'item_id query parameter is required',
            });
        }
        // Fetch blocked date ranges for the item
        const blockedRanges = await itemAvailability_1.default.find({
            item_id: item_id,
        })
            .sort({ blocked_start_date: 1 })
            .lean();
        // Format for API response
        const formattedRanges = blockedRanges.map((range) => ({
            id: range._id.toString(),
            item_id: range.item_id,
            blocked_start_date: range.blocked_start_date.toISOString(),
            blocked_end_date: range.blocked_end_date.toISOString(),
            reason: range.reason,
            created_at: range.created_at?.toISOString() || new Date().toISOString(),
        }));
        res.json({
            success: true,
            data: formattedRanges,
        });
    }
    catch (error) {
        console.error('Error fetching item availability:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});
/**
 * POST /api/item-availability
 * Create a blocked date range for an item
 * Requires authentication (must be item owner or admin)
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
        const { item_id, blocked_start_date, blocked_end_date, reason } = req.body;
        // Validate required fields
        if (!item_id || !blocked_start_date || !blocked_end_date) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: item_id, blocked_start_date, blocked_end_date',
            });
        }
        // Verify user is the item owner or admin
        const user = await (0, userSync_1.getOrSyncUser)(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
            });
        }
        // Import Item model to check ownership
        const Item = (await Promise.resolve().then(() => __importStar(require('../models/items')))).default;
        const item = await Item.findById(item_id).lean();
        if (!item) {
            return res.status(404).json({
                success: false,
                error: 'Item not found',
            });
        }
        // Check if user is owner or admin
        if (user.role !== 'admin' && item.owner_id !== userId) {
            return res.status(403).json({
                success: false,
                error: 'Only the item owner or admin can block dates',
            });
        }
        // Validate dates
        const startDate = new Date(blocked_start_date);
        const endDate = new Date(blocked_end_date);
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return res.status(400).json({
                success: false,
                error: 'Invalid date format',
            });
        }
        if (startDate >= endDate) {
            return res.status(400).json({
                success: false,
                error: 'blocked_start_date must be before blocked_end_date',
            });
        }
        // Check for overlapping dates
        const overlapping = await itemAvailability_1.default.findOne({
            item_id,
            $or: [
                {
                    blocked_start_date: { $lte: endDate },
                    blocked_end_date: { $gte: startDate },
                },
            ],
        });
        if (overlapping) {
            return res.status(400).json({
                success: false,
                error: 'Date range overlaps with existing blocked dates',
            });
        }
        // Create blocked date range
        const blockedRange = new itemAvailability_1.default({
            item_id,
            blocked_start_date: startDate,
            blocked_end_date: endDate,
            reason: reason || 'personal_use',
        });
        await blockedRange.save();
        console.log(`✅ Created blocked date range for item ${item_id} by user ${userId}`);
        // Format for API response
        const formattedRange = {
            id: blockedRange._id.toString(),
            item_id: blockedRange.item_id,
            blocked_start_date: blockedRange.blocked_start_date.toISOString(),
            blocked_end_date: blockedRange.blocked_end_date.toISOString(),
            reason: blockedRange.reason,
            created_at: blockedRange.created_at?.toISOString() || new Date().toISOString(),
        };
        res.json({
            success: true,
            data: formattedRange,
        });
    }
    catch (error) {
        console.error('Error creating item availability:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});
/**
 * DELETE /api/item-availability/:id
 * Delete a blocked date range
 * Requires authentication (must be item owner or admin)
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
        // Find the blocked range
        const blockedRange = await itemAvailability_1.default.findById(id).lean();
        if (!blockedRange) {
            return res.status(404).json({
                success: false,
                error: 'Blocked date range not found',
            });
        }
        // Verify user is the item owner or admin
        const user = await (0, userSync_1.getOrSyncUser)(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
            });
        }
        // Import Item model to check ownership
        const Item = (await Promise.resolve().then(() => __importStar(require('../models/items')))).default;
        const item = await Item.findById(blockedRange.item_id).lean();
        if (!item) {
            return res.status(404).json({
                success: false,
                error: 'Item not found',
            });
        }
        // Check if user is owner or admin
        if (user.role !== 'admin' && item.owner_id !== userId) {
            return res.status(403).json({
                success: false,
                error: 'Only the item owner or admin can delete blocked dates',
            });
        }
        // Delete the blocked range
        await itemAvailability_1.default.findByIdAndDelete(id);
        console.log(`✅ Deleted blocked date range ${id} by user ${userId}`);
        res.json({
            success: true,
        });
    }
    catch (error) {
        console.error('Error deleting item availability:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});
exports.default = router;
//# sourceMappingURL=itemAvailability.js.map