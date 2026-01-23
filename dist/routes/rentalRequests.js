"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const clerk_1 = require("../middleware/clerk");
const rentalRequests_1 = __importDefault(require("../models/rentalRequests"));
const router = (0, express_1.Router)();
/**
 * GET /api/rental-requests
 * Get rental requests for the current user
 * Query params: renter_email, owner_email, sort
 * Requires authentication
 */
router.get('/', clerk_1.requireAuth, async (req, res) => {
    try {
        // Get authenticated user using getAuth helper to avoid deprecation warnings
        const auth = (0, clerk_1.getAuth)(req);
        const userId = auth?.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
            });
        }
        // Build query based on query parameters
        const query = {};
        if (req.query.renter_email) {
            query.renter_email = req.query.renter_email;
        }
        if (req.query.owner_email) {
            query.owner_email = req.query.owner_email;
        }
        // Build sort object
        let sort = { updated_at: -1 }; // Default sort by updated_at descending
        if (req.query.sort) {
            const sortParam = req.query.sort;
            if (sortParam.startsWith('-')) {
                // Descending sort
                const field = sortParam.substring(1);
                sort = { [field]: -1 };
            }
            else {
                // Ascending sort
                sort = { [sortParam]: 1 };
            }
        }
        const requests = await rentalRequests_1.default.find(query).sort(sort);
        // Format requests for API response
        const formattedRequests = requests.map((request) => ({
            id: request._id.toString(),
            item_id: request.item_id,
            renter_email: request.renter_email,
            owner_email: request.owner_email,
            status: request.status,
            start_date: request.start_date.toISOString(),
            end_date: request.end_date.toISOString(),
            total_amount: request.total_amount,
            message: request.message,
            created_date: request.created_at?.toISOString() || new Date().toISOString(),
            updated_date: request.updated_at?.toISOString() || new Date().toISOString(),
        }));
        return res.json({
            success: true,
            data: formattedRequests,
        });
    }
    catch (error) {
        console.error('Error fetching rental requests:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch rental requests',
        });
    }
});
/**
 * POST /api/rental-requests
 * Create a new rental request
 * Requires authentication
 */
router.post('/', clerk_1.requireAuth, async (req, res) => {
    try {
        const auth = (0, clerk_1.getAuth)(req);
        const userId = auth?.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
            });
        }
        const { item_id, renter_email, owner_email, start_date, end_date, total_amount, message, status } = req.body;
        // Validate required fields
        if (!item_id || !renter_email || !owner_email || !start_date || !end_date || total_amount === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: item_id, renter_email, owner_email, start_date, end_date, total_amount',
            });
        }
        // Create rental request
        const rentalRequest = new rentalRequests_1.default({
            item_id,
            renter_email,
            owner_email,
            start_date: new Date(start_date),
            end_date: new Date(end_date),
            total_amount: parseFloat(total_amount),
            message: message?.trim(),
            status: status || 'pending',
        });
        await rentalRequest.save();
        // Format response
        const formattedRequest = {
            id: rentalRequest._id.toString(),
            item_id: rentalRequest.item_id,
            renter_email: rentalRequest.renter_email,
            owner_email: rentalRequest.owner_email,
            status: rentalRequest.status,
            start_date: rentalRequest.start_date.toISOString(),
            end_date: rentalRequest.end_date.toISOString(),
            total_amount: rentalRequest.total_amount,
            message: rentalRequest.message,
            created_date: rentalRequest.created_at?.toISOString() || new Date().toISOString(),
            updated_date: rentalRequest.updated_at?.toISOString() || new Date().toISOString(),
        };
        return res.status(201).json({
            success: true,
            data: formattedRequest,
        });
    }
    catch (error) {
        console.error('Error creating rental request:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to create rental request',
        });
    }
});
/**
 * PUT /api/rental-requests/:id
 * Update a rental request
 * Requires authentication
 */
router.put('/:id', clerk_1.requireAuth, async (req, res) => {
    try {
        const auth = (0, clerk_1.getAuth)(req);
        const userId = auth?.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
            });
        }
        const { id } = req.params;
        const updateData = {};
        // Allow updating these fields
        if (req.body.status !== undefined) {
            updateData.status = req.body.status;
        }
        if (req.body.start_date !== undefined) {
            updateData.start_date = new Date(req.body.start_date);
        }
        if (req.body.end_date !== undefined) {
            updateData.end_date = new Date(req.body.end_date);
        }
        if (req.body.total_amount !== undefined) {
            updateData.total_amount = parseFloat(req.body.total_amount);
        }
        if (req.body.message !== undefined) {
            updateData.message = req.body.message?.trim();
        }
        const rentalRequest = await rentalRequests_1.default.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
        if (!rentalRequest) {
            return res.status(404).json({
                success: false,
                error: 'Rental request not found',
            });
        }
        // Format response
        const formattedRequest = {
            id: rentalRequest._id.toString(),
            item_id: rentalRequest.item_id,
            renter_email: rentalRequest.renter_email,
            owner_email: rentalRequest.owner_email,
            status: rentalRequest.status,
            start_date: rentalRequest.start_date.toISOString(),
            end_date: rentalRequest.end_date.toISOString(),
            total_amount: rentalRequest.total_amount,
            message: rentalRequest.message,
            created_date: rentalRequest.created_at?.toISOString() || new Date().toISOString(),
            updated_date: rentalRequest.updated_at?.toISOString() || new Date().toISOString(),
        };
        return res.json({
            success: true,
            data: formattedRequest,
        });
    }
    catch (error) {
        console.error('Error updating rental request:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to update rental request',
        });
    }
});
/**
 * DELETE /api/rental-requests/:id
 * Delete a rental request
 * Requires authentication
 */
router.delete('/:id', clerk_1.requireAuth, async (req, res) => {
    try {
        const auth = (0, clerk_1.getAuth)(req);
        const userId = auth?.userId;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
            });
        }
        const { id } = req.params;
        const rentalRequest = await rentalRequests_1.default.findByIdAndDelete(id);
        if (!rentalRequest) {
            return res.status(404).json({
                success: false,
                error: 'Rental request not found',
            });
        }
        return res.json({
            success: true,
            message: 'Rental request deleted successfully',
        });
    }
    catch (error) {
        console.error('Error deleting rental request:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to delete rental request',
        });
    }
});
exports.default = router;
//# sourceMappingURL=rentalRequests.js.map