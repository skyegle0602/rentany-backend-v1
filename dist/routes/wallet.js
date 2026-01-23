"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const clerk_1 = require("../middleware/clerk");
const userSync_1 = require("../services/userSync");
const database_1 = require("../config/database");
const router = (0, express_1.Router)();
/**
 * GET /api/wallet
 * Get wallet data for the current user
 * Returns total earnings, completed transactions, held transactions
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
        // For now, return default wallet data
        // In a real system, you'd calculate this from actual rental transactions
        const walletData = {
            totalEarnings: 0,
            completedTransactions: [],
            heldTransactions: [],
        };
        res.json({
            success: true,
            data: walletData,
        });
    }
    catch (error) {
        console.error('Error fetching wallet data:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});
exports.default = router;
//# sourceMappingURL=wallet.js.map