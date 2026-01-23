import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/clerk'
import ItemAvailability from '../models/itemAvailability'
import { isDatabaseConnected } from '../config/database'
import { getOrSyncUser } from '../services/userSync'

const router = Router()

/**
 * GET /api/item-availability
 * Get blocked date ranges for an item
 * Query parameters:
 * - item_id: The item ID to get availability for
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    if (!isDatabaseConnected()) {
      return res.status(503).json({
        success: false,
        error: 'Database is not available. Please try again in a moment.',
      })
    }

    const { item_id } = req.query

    if (!item_id) {
      return res.status(400).json({
        success: false,
        error: 'item_id query parameter is required',
      })
    }

    // Fetch blocked date ranges for the item
    const blockedRanges = await ItemAvailability.find({
      item_id: item_id as string,
    })
      .sort({ blocked_start_date: 1 })
      .lean()

    // Format for API response
    const formattedRanges = blockedRanges.map((range) => ({
      id: range._id.toString(),
      item_id: range.item_id,
      blocked_start_date: range.blocked_start_date.toISOString(),
      blocked_end_date: range.blocked_end_date.toISOString(),
      reason: range.reason,
      created_at: range.created_at?.toISOString() || new Date().toISOString(),
    }))

    res.json({
      success: true,
      data: formattedRanges,
    })
  } catch (error) {
    console.error('Error fetching item availability:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
})

/**
 * POST /api/item-availability
 * Create a blocked date range for an item
 * Requires authentication (must be item owner or admin)
 */
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!isDatabaseConnected()) {
      return res.status(503).json({
        success: false,
        error: 'Database is not available. Please try again in a moment.',
      })
    }

    // Get authenticated user
    let auth: { userId?: string | null } | undefined
    try {
      if (typeof (req as any).auth === 'function') {
        auth = (req as any).auth()
      } else {
        auth = (req as any).auth
      }
    } catch {
      auth = (req as any).auth
    }
    const userId = auth?.userId

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      })
    }

    const { item_id, blocked_start_date, blocked_end_date, reason } = req.body

    // Validate required fields
    if (!item_id || !blocked_start_date || !blocked_end_date) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: item_id, blocked_start_date, blocked_end_date',
      })
    }

    // Verify user is the item owner or admin
    const user = await getOrSyncUser(userId)
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      })
    }

    // Import Item model to check ownership
    const Item = (await import('../models/items')).default
    const item = await Item.findById(item_id).lean()

    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Item not found',
      })
    }

    // Check if user is owner or admin
    if (user.role !== 'admin' && item.owner_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Only the item owner or admin can block dates',
      })
    }

    // Validate dates
    const startDate = new Date(blocked_start_date)
    const endDate = new Date(blocked_end_date)

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format',
      })
    }

    if (startDate >= endDate) {
      return res.status(400).json({
        success: false,
        error: 'blocked_start_date must be before blocked_end_date',
      })
    }

    // Check for overlapping dates
    const overlapping = await ItemAvailability.findOne({
      item_id,
      $or: [
        {
          blocked_start_date: { $lte: endDate },
          blocked_end_date: { $gte: startDate },
        },
      ],
    })

    if (overlapping) {
      return res.status(400).json({
        success: false,
        error: 'Date range overlaps with existing blocked dates',
      })
    }

    // Create blocked date range
    const blockedRange = new ItemAvailability({
      item_id,
      blocked_start_date: startDate,
      blocked_end_date: endDate,
      reason: reason || 'personal_use',
    })

    await blockedRange.save()

    console.log(`✅ Created blocked date range for item ${item_id} by user ${userId}`)

    // Format for API response
    const formattedRange = {
      id: blockedRange._id.toString(),
      item_id: blockedRange.item_id,
      blocked_start_date: blockedRange.blocked_start_date.toISOString(),
      blocked_end_date: blockedRange.blocked_end_date.toISOString(),
      reason: blockedRange.reason,
      created_at: blockedRange.created_at?.toISOString() || new Date().toISOString(),
    }

    res.json({
      success: true,
      data: formattedRange,
    })
  } catch (error) {
    console.error('Error creating item availability:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
})

/**
 * DELETE /api/item-availability/:id
 * Delete a blocked date range
 * Requires authentication (must be item owner or admin)
 */
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!isDatabaseConnected()) {
      return res.status(503).json({
        success: false,
        error: 'Database is not available. Please try again in a moment.',
      })
    }

    // Get authenticated user
    let auth: { userId?: string | null } | undefined
    try {
      if (typeof (req as any).auth === 'function') {
        auth = (req as any).auth()
      } else {
        auth = (req as any).auth
      }
    } catch {
      auth = (req as any).auth
    }
    const userId = auth?.userId

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      })
    }

    const { id } = req.params

    // Find the blocked range
    const blockedRange = await ItemAvailability.findById(id).lean()

    if (!blockedRange) {
      return res.status(404).json({
        success: false,
        error: 'Blocked date range not found',
      })
    }

    // Verify user is the item owner or admin
    const user = await getOrSyncUser(userId)
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      })
    }

    // Import Item model to check ownership
    const Item = (await import('../models/items')).default
    const item = await Item.findById(blockedRange.item_id).lean()

    if (!item) {
      return res.status(404).json({
        success: false,
        error: 'Item not found',
      })
    }

    // Check if user is owner or admin
    if (user.role !== 'admin' && item.owner_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Only the item owner or admin can delete blocked dates',
      })
    }

    // Delete the blocked range
    await ItemAvailability.findByIdAndDelete(id)

    console.log(`✅ Deleted blocked date range ${id} by user ${userId}`)

    res.json({
      success: true,
    })
  } catch (error) {
    console.error('Error deleting item availability:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
})

export default router
