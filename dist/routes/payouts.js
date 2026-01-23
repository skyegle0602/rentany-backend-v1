"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const clerk_1 = require("../middleware/clerk");
const userSync_1 = require("../services/userSync");
const database_1 = require("../config/database");
const router = (0, express_1.Router)();
/**
 * GET /api/payouts
 * Get payouts for the current user
 */
router.get('/', clerk_1.requireAuth, async (req, res) => {
    try {
        if (!(0, database_1.isDatabaseConnected)()) {
            return res.status(503).json({
                success: false,
                error: 'Database is not available. Please try again in a moment.',
            });
        }
        // Get authenticated user using getAuth helper to avoid deprecation warnings
        const auth = (0, clerk_1.getAuth)(req);
        const userId = auth?.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized',
            });
        }
        const user = await (0, userSync_1.getOrSyncUser)(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
            });
        }
        // For now, return empty payouts array
        // In a real system, you'd fetch from a payouts collection
        res.json({
            success: true,
            data: [],
        });
    }
    catch (error) {
        console.error('Error fetching payouts:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});
exports.default = router;
//# sourceMappingURL=payouts.js.map