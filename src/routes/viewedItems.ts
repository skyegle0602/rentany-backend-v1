import { Router, Request, Response } from 'express'
import ViewedItem from '../models/viewedItems'
import { requireAuth } from '../middleware/clerk'

const router = Router()

/**
 * GET /api/viewed-items
 * Get viewed items for a user, optionally filtered by item_id
 * Query params: user_email, item_id (optional)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { user_email, item_id } = req.query

    console.log('📊 GET /api/viewed-items - Request received:', { user_email, item_id })

    if (!user_email) {
      return res.status(400).json({
        success: false,
        error: 'user_email query parameter is required',
      })
    }

    const query: any = { user_email: user_email as string }
    if (item_id) {
      query.item_id = item_id as string
    }

    const viewedItems = await ViewedItem.find(query).sort({ viewed_date: -1 })

    console.log(`✅ Found ${viewedItems.length} viewed items for user:`, user_email)

    res.json({
      success: true,
      data: viewedItems,
    })
  } catch (error) {
    console.error('Error fetching viewed items:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
})

/**
 * POST /api/viewed-items
 * Create or update a viewed item record
 * Uses upsert to handle race conditions atomically
 * Requires authentication
 */
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { user_email, item_id, viewed_date, view_count } = req.body

    console.log('📊 POST /api/viewed-items - Request received:', { user_email, item_id, viewed_date })

    if (!user_email || !item_id) {
      console.error('❌ Missing required fields:', { user_email: !!user_email, item_id: !!item_id })
      return res.status(400).json({
        success: false,
        error: 'user_email and item_id are required',
      })
    }

    // Use findOneAndUpdate with upsert to atomically handle create/update
    // This prevents race conditions where two requests try to create the same record
    const updateDate = viewed_date ? new Date(viewed_date) : new Date()
    
    const viewedItem = await ViewedItem.findOneAndUpdate(
      { user_email, item_id },
      {
        $inc: { view_count: 1 }, // Increment view count (works for both new and existing)
        $set: {
          viewed_date: updateDate,
        },
        $setOnInsert: {
          // Only set these fields when creating a new document
          user_email,
          item_id,
        },
      },
      {
        upsert: true, // Create if doesn't exist
        new: true, // Return the updated document
        runValidators: true, // Run schema validators
      }
    )

    console.log('✅ Viewed item saved/updated:', {
      id: viewedItem._id,
      user_email: viewedItem.user_email,
      item_id: viewedItem.item_id,
      view_count: viewedItem.view_count,
      viewed_date: viewedItem.viewed_date,
    })

    res.json({
      success: true,
      data: viewedItem,
    })
  } catch (error: any) {
    // Handle duplicate key error gracefully (shouldn't happen with upsert, but just in case)
    if (error.code === 11000) {
      // Duplicate key error - try to fetch and return the existing record
      try {
        const existing = await ViewedItem.findOne({ 
          user_email: req.body.user_email, 
          item_id: req.body.item_id 
        })
        if (existing) {
          // Update the existing record
          existing.view_count = (existing.view_count || 1) + 1
          existing.viewed_date = req.body.viewed_date ? new Date(req.body.viewed_date) : new Date()
          await existing.save()
          
          return res.json({
            success: true,
            data: existing,
          })
        }
      } catch (fallbackError) {
        console.error('Error in fallback handling:', fallbackError)
      }
    }
    
    console.error('Error creating/updating viewed item:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
})

/**
 * PUT /api/viewed-items/:id
 * Update an existing viewed item record
 * Requires authentication
 */
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { view_count, viewed_date } = req.body

    const viewedItem = await ViewedItem.findById(id)

    if (!viewedItem) {
      return res.status(404).json({
        success: false,
        error: 'Viewed item not found',
      })
    }

    if (view_count !== undefined) {
      viewedItem.view_count = view_count
    }
    if (viewed_date) {
      viewedItem.viewed_date = new Date(viewed_date)
    }

    await viewedItem.save()

    res.json({
      success: true,
      data: viewedItem,
    })
  } catch (error) {
    console.error('Error updating viewed item:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
})

/**
 * DELETE /api/viewed-items/:id
 * Delete a viewed item record
 * Requires authentication
 */
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const viewedItem = await ViewedItem.findByIdAndDelete(id)

    if (!viewedItem) {
      return res.status(404).json({
        success: false,
        error: 'Viewed item not found',
      })
    }

    res.json({
      success: true,
      message: 'Viewed item deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting viewed item:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
})

export default router
