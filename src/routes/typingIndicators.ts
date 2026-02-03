import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/clerk'
import TypingIndicator from '../models/typingIndicators'
import { getAuth } from '../middleware/clerk'

const router = Router()

/**
 * GET /api/typing-indicators
 * Get typing indicators for a rental request
 * Query parameters: ?rental_request_id=xxx&user_email=xxx
 * Requires authentication
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const auth = getAuth(req)
    const userId = auth?.userId

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      })
    }

    const { rental_request_id, user_email } = req.query

    const query: any = {}
    if (rental_request_id && typeof rental_request_id === 'string') {
      query.rental_request_id = rental_request_id
    }
    if (user_email && typeof user_email === 'string') {
      query.user_email = user_email
    }

    // Only get active (non-expired) indicators
    const indicators = await TypingIndicator.find({
      ...query,
      expires_at: { $gt: new Date() },
    })
      .sort({ updated_at: -1 })
      .lean()

    // Format indicators for API response
    const formattedIndicators = indicators.map((indicator) => ({
      id: indicator._id.toString(),
      rental_request_id: indicator.rental_request_id,
      user_email: indicator.user_email,
      is_typing: indicator.is_typing,
      expires_at: indicator.expires_at.toISOString(),
      created_at: indicator.created_at?.toISOString() || new Date().toISOString(),
      updated_at: indicator.updated_at?.toISOString() || new Date().toISOString(),
    }))

    res.json({
      success: true,
      data: formattedIndicators,
    })
  } catch (error) {
    console.error('Error fetching typing indicators:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
})

/**
 * GET /api/typing-indicators/:id
 * Get a specific typing indicator by ID
 * Requires authentication
 */
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const auth = getAuth(req)
    const userId = auth?.userId

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      })
    }

    const { id } = req.params

    const indicator = await TypingIndicator.findById(id).lean()

    if (!indicator) {
      return res.status(404).json({
        success: false,
        error: 'Typing indicator not found',
      })
    }

    // Check if expired
    if (indicator.expires_at < new Date()) {
      return res.status(404).json({
        success: false,
        error: 'Typing indicator expired',
      })
    }

    // Format indicator for API response
    const formattedIndicator = {
      id: indicator._id.toString(),
      rental_request_id: indicator.rental_request_id,
      user_email: indicator.user_email,
      is_typing: indicator.is_typing,
      expires_at: indicator.expires_at.toISOString(),
      created_at: indicator.created_at?.toISOString() || new Date().toISOString(),
      updated_at: indicator.updated_at?.toISOString() || new Date().toISOString(),
    }

    res.json({
      success: true,
      data: formattedIndicator,
    })
  } catch (error) {
    console.error('Error fetching typing indicator:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
})

/**
 * POST /api/typing-indicators
 * Create or update a typing indicator
 * Requires authentication
 */
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const auth = getAuth(req)
    const userId = auth?.userId

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      })
    }

    const { rental_request_id, user_email, is_typing } = req.body

    if (!rental_request_id) {
      return res.status(400).json({
        success: false,
        error: 'rental_request_id is required',
      })
    }

    if (!user_email) {
      return res.status(400).json({
        success: false,
        error: 'user_email is required',
      })
    }

    // Use provided expires_at or default to 3 seconds from now
    const expiresAt = req.body.expires_at 
      ? new Date(req.body.expires_at)
      : new Date(Date.now() + 3000)

    // Try to find existing indicator
    const existingIndicator = await TypingIndicator.findOne({
      rental_request_id,
      user_email,
    })

    let indicator
    if (existingIndicator) {
      // Update existing indicator
      existingIndicator.is_typing = is_typing !== undefined ? is_typing : true
      existingIndicator.expires_at = expiresAt
      await existingIndicator.save()
      indicator = existingIndicator
    } else {
      // Create new indicator
      indicator = new TypingIndicator({
        rental_request_id,
        user_email,
        is_typing: is_typing !== undefined ? is_typing : true,
        expires_at: expiresAt,
      })
      await indicator.save()
    }

    // Format indicator for API response
    const formattedIndicator = {
      id: indicator._id.toString(),
      rental_request_id: indicator.rental_request_id,
      user_email: indicator.user_email,
      is_typing: indicator.is_typing,
      expires_at: indicator.expires_at.toISOString(),
      created_at: indicator.created_at?.toISOString() || new Date().toISOString(),
      updated_at: indicator.updated_at?.toISOString() || new Date().toISOString(),
    }

    res.status(201).json({
      success: true,
      data: formattedIndicator,
    })
  } catch (error) {
    console.error('Error creating/updating typing indicator:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
})

/**
 * PUT /api/typing-indicators/:id
 * Update a typing indicator
 * Requires authentication
 */
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const auth = getAuth(req)
    const userId = auth?.userId

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      })
    }

    const { id } = req.params
    const updateData: any = {}

    // Allow updating these fields
    if (req.body.is_typing !== undefined) {
      updateData.is_typing = req.body.is_typing
    }
    if (req.body.expires_at !== undefined) {
      updateData.expires_at = new Date(req.body.expires_at)
    } else {
      // If not provided, extend expiration by 3 seconds
      updateData.expires_at = new Date(Date.now() + 3000)
    }

    const indicator = await TypingIndicator.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )

    if (!indicator) {
      return res.status(404).json({
        success: false,
        error: 'Typing indicator not found',
      })
    }

    // Format indicator for API response
    const formattedIndicator = {
      id: indicator._id.toString(),
      rental_request_id: indicator.rental_request_id,
      user_email: indicator.user_email,
      is_typing: indicator.is_typing,
      expires_at: indicator.expires_at.toISOString(),
      created_at: indicator.created_at?.toISOString() || new Date().toISOString(),
      updated_at: indicator.updated_at?.toISOString() || new Date().toISOString(),
    }

    res.json({
      success: true,
      data: formattedIndicator,
    })
  } catch (error) {
    console.error('Error updating typing indicator:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
})

/**
 * DELETE /api/typing-indicators/:id
 * Delete a typing indicator
 * Requires authentication
 */
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const auth = getAuth(req)
    const userId = auth?.userId

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      })
    }

    const { id } = req.params

    const indicator = await TypingIndicator.findByIdAndDelete(id)

    if (!indicator) {
      return res.status(404).json({
        success: false,
        error: 'Typing indicator not found',
      })
    }

    res.json({
      success: true,
      message: 'Typing indicator deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting typing indicator:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
})

export default router
