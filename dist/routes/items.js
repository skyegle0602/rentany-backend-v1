"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const clerk_1 = require("../middleware/clerk");
const items_1 = __importDefault(require("../models/items"));
const database_1 = require("../config/database");
const userSync_1 = require("../services/userSync");
const reviews_1 = __importDefault(require("../models/reviews"));
const viewedItems_1 = __importDefault(require("../models/viewedItems"));
const favorites_1 = __importDefault(require("../models/favorites"));
const itemAvailability_1 = __importDefault(require("../models/itemAvailability"));
const router = (0, express_1.Router)();
/**
 * GET /api/items
 * Get items with optional filters and sorting
 * Query parameters:
 * - search: Search by item title/name (case-insensitive)
 * - category: Filter by category
 * - location: Filter by location
 * - min_price: Minimum daily rate
 * - max_price: Maximum daily rate
 * - owner_id: Filter by owner
 * - availability: Filter by availability (true/false)
 * - sort_by: Sort order - "relevance" | "price_low" | "price_high" | "rating" | "newest" | "popular"
 */
router.get('/', async (req, res) => {
    try {
        if (!(0, database_1.isDatabaseConnected)()) {
            return res.status(503).json({
                success: false,
                error: 'Database is not available. Please try again in a moment.',
            });
        }
        const { search, category, location, min_price, max_price, owner_id, availability, limit, sort_by } = req.query;
        // Build query
        const query = {};
        // Search by title/name (case-insensitive)
        if (search) {
            query.title = { $regex: search, $options: 'i' };
        }
        if (category && category !== 'all') {
            query.category = category;
        }
        if (location) {
            query.location = { $regex: location, $options: 'i' };
        }
        if (min_price) {
            query.daily_rate = { ...query.daily_rate, $gte: parseFloat(min_price) };
        }
        if (max_price) {
            query.daily_rate = { ...query.daily_rate, $lte: parseFloat(max_price) };
        }
        if (owner_id) {
            query.owner_id = owner_id;
        }
        if (availability !== undefined) {
            const availValue = Array.isArray(availability) ? availability[0] : availability;
            query.availability = String(availValue).toLowerCase() === 'true';
        }
        // Only show active items by default
        query.status = query.status || 'active';
        // Build query with limit if provided
        let itemsQuery = items_1.default.find(query);
        // Apply sorting based on sort_by parameter
        const sortBy = sort_by || 'relevance';
        switch (sortBy) {
            case 'price_low':
                itemsQuery = itemsQuery.sort({ daily_rate: 1 }); // Low to high
                break;
            case 'price_high':
                itemsQuery = itemsQuery.sort({ daily_rate: -1 }); // High to low
                break;
            case 'newest':
                itemsQuery = itemsQuery.sort({ created_at: -1 }); // Newest first
                break;
            case 'rating':
                // Will sort after fetching by calculating average ratings
                itemsQuery = itemsQuery.sort({ created_at: -1 }); // Default sort, will re-sort after
                break;
            case 'popular':
                // Will sort after fetching by view_count or rental count
                itemsQuery = itemsQuery.sort({ created_at: -1 }); // Default sort, will re-sort after
                break;
            case 'relevance':
            default:
                // Relevance: prioritize items matching search, then by created_at
                if (search) {
                    itemsQuery = itemsQuery.sort({ created_at: -1 });
                }
                else {
                    itemsQuery = itemsQuery.sort({ created_at: -1 });
                }
                break;
        }
        if (limit) {
            itemsQuery = itemsQuery.limit(parseInt(limit, 10));
        }
        // Fetch items
        let items = await itemsQuery.lean();
        // For rating and popular sorting, we need to enrich items with additional data
        if (sortBy === 'rating' || sortBy === 'popular') {
            // Get all item IDs
            const itemIds = items.map(item => item._id.toString());
            if (sortBy === 'rating') {
                // Get unique owner IDs from items
                const ownerIds = [...new Set(items.map(item => item.owner_id))];
                // Calculate average ratings for each owner (reviews where review_type is 'for_owner' and reviewee_id matches owner_id)
                const reviews = await reviews_1.default.find({
                    reviewee_id: { $in: ownerIds },
                    review_type: 'for_owner'
                }).lean();
                // Group reviews by owner_id (reviewee_id) and calculate average rating
                const ownerRatings = {};
                reviews.forEach(review => {
                    const ownerId = review.reviewee_id;
                    if (ownerId) {
                        if (!ownerRatings[ownerId]) {
                            ownerRatings[ownerId] = { total: 0, count: 0, average: 0 };
                        }
                        ownerRatings[ownerId].total += review.rating;
                        ownerRatings[ownerId].count += 1;
                    }
                });
                // Calculate averages
                Object.keys(ownerRatings).forEach(ownerId => {
                    ownerRatings[ownerId].average = ownerRatings[ownerId].count > 0
                        ? ownerRatings[ownerId].total / ownerRatings[ownerId].count
                        : 0;
                });
                // Sort items by owner's average rating (highest first)
                items = items.sort((a, b) => {
                    const ratingA = ownerRatings[a.owner_id]?.average || 0;
                    const ratingB = ownerRatings[b.owner_id]?.average || 0;
                    return ratingB - ratingA;
                });
            }
            else if (sortBy === 'popular') {
                // For popularity, we'll use view_count from viewedItems
                // In a real system, you'd track actual rentals, but for now we'll use view_count as a proxy
                const viewedItems = await viewedItems_1.default.find({
                    item_id: { $in: itemIds }
                }).lean();
                // Calculate total views per item
                const itemViews = {};
                viewedItems.forEach(viewed => {
                    const itemId = viewed.item_id;
                    itemViews[itemId] = (itemViews[itemId] || 0) + (viewed.view_count || 1);
                });
                // Sort items by view count (most viewed first)
                items = items.sort((a, b) => {
                    const viewsA = itemViews[a._id.toString()] || 0;
                    const viewsB = itemViews[b._id.toString()] || 0;
                    return viewsB - viewsA;
                });
            }
        }
        // Format items for API response
        const formattedItems = items.map((item) => ({
            id: item._id.toString(),
            owner_id: item.owner_id,
            title: item.title,
            description: item.description,
            category: item.category,
            daily_rate: item.daily_rate,
            pricing_tiers: item.pricing_tiers || [],
            deposit: item.deposit || 0,
            condition: item.condition,
            location: item.location,
            street_address: item.street_address,
            postcode: item.postcode,
            country: item.country,
            lat: item.lat,
            lng: item.lng,
            show_on_map: item.show_on_map,
            min_rental_days: item.min_rental_days,
            max_rental_days: item.max_rental_days,
            notice_period_hours: item.notice_period_hours,
            instant_booking: item.instant_booking,
            same_day_pickup: item.same_day_pickup,
            delivery_options: item.delivery_options || [],
            delivery_fee: item.delivery_fee || 0,
            delivery_radius: item.delivery_radius,
            images: item.images || [],
            videos: item.videos || [],
            availability: item.availability,
            status: item.status || 'active',
            created_at: item.created_at?.toISOString() || new Date().toISOString(),
            updated_at: item.updated_at?.toISOString() || new Date().toISOString(),
        }));
        res.json({
            success: true,
            data: formattedItems,
        });
    }
    catch (error) {
        console.error('Error fetching items:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});
/**
 * GET /api/items/:id
 * Get a single item by ID
 */
router.get('/:id', async (req, res) => {
    try {
        if (!(0, database_1.isDatabaseConnected)()) {
            return res.status(503).json({
                success: false,
                error: 'Database is not available. Please try again in a moment.',
            });
        }
        const { id } = req.params;
        // Ensure id is a string (Express params can be string | string[])
        const itemId = Array.isArray(id) ? id[0] : id;
        console.log(`[GET /api/items/:id] Requested item ID: ${itemId}`);
        // Validate MongoDB ObjectId format (24 hex characters)
        if (!itemId || !/^[0-9a-fA-F]{24}$/.test(itemId)) {
            console.log(`[GET /api/items/:id] Invalid ID format: ${itemId}`);
            return res.status(400).json({
                success: false,
                error: 'Invalid item ID format',
            });
        }
        console.log(`[GET /api/items/:id] Looking up item with ID: ${itemId}`);
        const item = await items_1.default.findById(itemId).lean();
        if (!item) {
            console.log(`[GET /api/items/:id] Item not found: ${itemId}`);
        }
        else {
            console.log(`[GET /api/items/:id] Item found: ${item.title}`);
        }
        if (!item) {
            console.log(`[GET /api/items/:id] Item not found: ${id}`);
        }
        else {
            console.log(`[GET /api/items/:id] Item found: ${item.title}`);
        }
        if (!item) {
            return res.status(404).json({
                success: false,
                error: 'Item not found',
            });
        }
        // Format item for API response
        const formattedItem = {
            id: item._id.toString(),
            owner_id: item.owner_id,
            title: item.title,
            description: item.description,
            category: item.category,
            daily_rate: item.daily_rate,
            pricing_tiers: item.pricing_tiers || [],
            deposit: item.deposit || 0,
            condition: item.condition,
            location: item.location,
            street_address: item.street_address,
            postcode: item.postcode,
            country: item.country,
            lat: item.lat,
            lng: item.lng,
            show_on_map: item.show_on_map,
            min_rental_days: item.min_rental_days,
            max_rental_days: item.max_rental_days,
            notice_period_hours: item.notice_period_hours,
            instant_booking: item.instant_booking,
            same_day_pickup: item.same_day_pickup,
            delivery_options: item.delivery_options || [],
            delivery_fee: item.delivery_fee || 0,
            delivery_radius: item.delivery_radius,
            images: item.images || [],
            videos: item.videos || [],
            availability: item.availability,
            status: item.status || 'active',
            created_at: item.created_at?.toISOString() || new Date().toISOString(),
            updated_at: item.updated_at?.toISOString() || new Date().toISOString(),
        };
        res.json({
            success: true,
            data: formattedItem,
        });
    }
    catch (error) {
        console.error('Error fetching item:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});
/**
 * POST /api/items
 * Create a new item
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
        // Verify user exists and is verified (or admin)
        const user = await (0, userSync_1.getOrSyncUser)(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
            });
        }
        // Check if user is verified or admin
        if (user.role !== 'admin' && user.verification_status !== 'verified') {
            return res.status(403).json({
                success: false,
                error: 'Identity verification required to list items',
            });
        }
        const { title, description, category, daily_rate, pricing_tiers, deposit, condition, location, street_address, postcode, country, lat, lng, show_on_map, min_rental_days, max_rental_days, notice_period_hours, instant_booking, same_day_pickup, delivery_options, delivery_fee, delivery_radius, images, videos, availability, } = req.body;
        // Debug: Log images being received
        console.log('📸 Creating item with images:', {
            imagesCount: images?.length || 0,
            images: images || [],
            videosCount: videos?.length || 0,
        });
        // Validate required fields
        if (!title || !description || !category || daily_rate === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: title, description, category, daily_rate',
            });
        }
        // Validate that at least one image is provided
        if (!images || !Array.isArray(images) || images.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'At least one image is required to list an item',
            });
        }
        // Filter out empty/invalid image URLs
        const validImages = images.filter((url) => url && typeof url === 'string' && url.trim().length > 0);
        if (validImages.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'At least one valid image URL is required',
            });
        }
        // Filter out empty/invalid video URLs
        const validVideos = videos && Array.isArray(videos)
            ? videos.filter((url) => url && typeof url === 'string' && url.trim().length > 0)
            : [];
        // Validate daily_rate
        if (daily_rate < 0) {
            return res.status(400).json({
                success: false,
                error: 'daily_rate must be greater than or equal to 0',
            });
        }
        // Create item
        const item = new items_1.default({
            owner_id: userId,
            title: title.trim(),
            description: description.trim(),
            category: category.trim(),
            daily_rate: parseFloat(daily_rate),
            pricing_tiers: pricing_tiers || [],
            deposit: deposit ? parseFloat(deposit) : 0,
            condition: condition || 'good',
            location: location.trim(),
            street_address: street_address?.trim(),
            postcode: postcode?.trim(),
            country: country?.trim(),
            lat: lat ? parseFloat(lat) : undefined,
            lng: lng ? parseFloat(lng) : undefined,
            show_on_map: show_on_map !== undefined ? show_on_map : true,
            min_rental_days: min_rental_days ? parseInt(min_rental_days) : 1,
            max_rental_days: max_rental_days ? parseInt(max_rental_days) : 30,
            notice_period_hours: notice_period_hours ? parseInt(notice_period_hours) : 24,
            instant_booking: instant_booking || false,
            same_day_pickup: same_day_pickup || false,
            delivery_options: delivery_options || ['pickup'],
            delivery_fee: delivery_fee ? parseFloat(delivery_fee) : 0,
            delivery_radius: delivery_radius ? parseFloat(delivery_radius) : undefined,
            images: validImages,
            videos: validVideos,
            availability: availability !== undefined ? availability : true,
            status: 'active',
        });
        await item.save();
        console.log(`✅ Created item: ${item.title} by user ${userId}`);
        console.log(`   Images saved: ${item.images?.length || 0} image(s)`);
        console.log(`   Image URLs:`, item.images || []);
        // Format item for API response
        const formattedItem = {
            id: item._id.toString(),
            owner_id: item.owner_id,
            title: item.title,
            description: item.description,
            category: item.category,
            daily_rate: item.daily_rate,
            pricing_tiers: item.pricing_tiers || [],
            deposit: item.deposit || 0,
            condition: item.condition,
            location: item.location,
            street_address: item.street_address,
            postcode: item.postcode,
            country: item.country,
            lat: item.lat,
            lng: item.lng,
            show_on_map: item.show_on_map,
            min_rental_days: item.min_rental_days,
            max_rental_days: item.max_rental_days,
            notice_period_hours: item.notice_period_hours,
            instant_booking: item.instant_booking,
            same_day_pickup: item.same_day_pickup,
            delivery_options: item.delivery_options || [],
            delivery_fee: item.delivery_fee || 0,
            delivery_radius: item.delivery_radius,
            images: item.images || [],
            videos: item.videos || [],
            availability: item.availability,
            status: item.status || 'active',
            created_at: item.created_at?.toISOString() || new Date().toISOString(),
            updated_at: item.updated_at?.toISOString() || new Date().toISOString(),
        };
        res.json({
            success: true,
            data: formattedItem,
        });
    }
    catch (error) {
        console.error('Error creating item:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});
/**
 * PUT /api/items/:id
 * Update an item
 * Requires authentication (must be owner or admin)
 */
router.put('/:id', clerk_1.requireAuth, async (req, res) => {
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
        // Find item
        const item = await items_1.default.findById(id);
        if (!item) {
            return res.status(404).json({
                success: false,
                error: 'Item not found',
            });
        }
        // Check if user is owner or admin
        if (item.owner_id !== userId) {
            const user = await (0, userSync_1.getOrSyncUser)(userId);
            if (!user || user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'You can only update your own items',
                });
            }
        }
        // Update allowed fields
        const allowedFields = [
            'title',
            'description',
            'category',
            'daily_rate',
            'pricing_tiers',
            'deposit',
            'condition',
            'location',
            'street_address',
            'postcode',
            'country',
            'lat',
            'lng',
            'show_on_map',
            'min_rental_days',
            'max_rental_days',
            'notice_period_hours',
            'instant_booking',
            'same_day_pickup',
            'delivery_options',
            'delivery_fee',
            'delivery_radius',
            'images',
            'videos',
            'availability',
            'status',
        ];
        const updateData = {};
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                if (field === 'daily_rate' || field === 'deposit' || field === 'delivery_fee' || field === 'delivery_radius') {
                    updateData[field] = parseFloat(req.body[field]);
                }
                else if (field === 'min_rental_days' || field === 'max_rental_days' || field === 'notice_period_hours') {
                    updateData[field] = parseInt(req.body[field]);
                }
                else if (field === 'lat' || field === 'lng') {
                    updateData[field] = req.body[field] ? parseFloat(req.body[field]) : undefined;
                }
                else {
                    updateData[field] = req.body[field];
                }
            }
        }
        // Update item
        Object.assign(item, updateData);
        await item.save();
        // Format item for API response
        const formattedItem = {
            id: item._id.toString(),
            owner_id: item.owner_id,
            title: item.title,
            description: item.description,
            category: item.category,
            daily_rate: item.daily_rate,
            pricing_tiers: item.pricing_tiers || [],
            deposit: item.deposit || 0,
            condition: item.condition,
            location: item.location,
            street_address: item.street_address,
            postcode: item.postcode,
            country: item.country,
            lat: item.lat,
            lng: item.lng,
            show_on_map: item.show_on_map,
            min_rental_days: item.min_rental_days,
            max_rental_days: item.max_rental_days,
            notice_period_hours: item.notice_period_hours,
            instant_booking: item.instant_booking,
            same_day_pickup: item.same_day_pickup,
            delivery_options: item.delivery_options || [],
            delivery_fee: item.delivery_fee || 0,
            delivery_radius: item.delivery_radius,
            images: item.images || [],
            videos: item.videos || [],
            availability: item.availability,
            status: item.status || 'active',
            created_at: item.created_at?.toISOString() || new Date().toISOString(),
            updated_at: item.updated_at?.toISOString() || new Date().toISOString(),
        };
        res.json({
            success: true,
            data: formattedItem,
        });
    }
    catch (error) {
        console.error('Error updating item:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});
/**
 * DELETE /api/items/:id
 * Delete an item
 * Requires authentication (must be owner or admin)
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
        // Find item
        const item = await items_1.default.findById(id);
        if (!item) {
            return res.status(404).json({
                success: false,
                error: 'Item not found',
            });
        }
        // Check if user is owner or admin
        if (item.owner_id !== userId) {
            const user = await (0, userSync_1.getOrSyncUser)(userId);
            if (!user || user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    error: 'You can only delete your own items',
                });
            }
        }
        // Delete related records first (viewedItems, favorites, itemAvailability, etc.)
        try {
            // Delete all viewedItems records for this item
            const viewedItemsDeleted = await viewedItems_1.default.deleteMany({ item_id: id });
            console.log(`[DELETE /api/items/:id] Deleted ${viewedItemsDeleted.deletedCount} viewedItems records for item ${id}`);
            // Delete all favorites for this item
            const favoritesDeleted = await favorites_1.default.deleteMany({ item_id: id });
            console.log(`[DELETE /api/items/:id] Deleted ${favoritesDeleted.deletedCount} favorites for item ${id}`);
            // Delete all itemAvailability records for this item
            const availabilityDeleted = await itemAvailability_1.default.deleteMany({ item_id: id });
            console.log(`[DELETE /api/items/:id] Deleted ${availabilityDeleted.deletedCount} availability records for item ${id}`);
        }
        catch (cleanupError) {
            // Log but don't fail the deletion if cleanup fails
            console.error(`[DELETE /api/items/:id] Error cleaning up related records for item ${id}:`, cleanupError);
        }
        // Delete item
        await items_1.default.findByIdAndDelete(id);
        console.log(`[DELETE /api/items/:id] Successfully deleted item ${id}`);
        res.json({
            success: true,
            message: 'Item deleted successfully',
        });
    }
    catch (error) {
        console.error('Error deleting item:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});
exports.default = router;
//# sourceMappingURL=items.js.map