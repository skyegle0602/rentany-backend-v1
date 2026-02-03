import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/clerk'
import RentalExtension from '../models/rentalExtensions'
import { getAuth } from '../middleware/clerk'

const router = Router()

/**
 * GET /api/rental-extensions
 * Get rental extensions
 * Query parameters: ?rental_request_id=xxx
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

    const { rental_request_id } = req.query

    const query: any = {}
    if (rental_request_id && typeof rental_request_id === 'string') {
      query.rental_request_id = rental_request_id
    }

    const extensions = await RentalExtension.find(query)
      .sort({ created_at: -1 }) // Sort by creation date descending (newest first)
      .lean()

    // Format extensions for API response
    const formattedExtensions = extensions.map((extension) => ({
      id: extension._id.toString(),
      rental_request_id: extension.rental_request_id,
      requested_by_email: extension.requested_by_email,
      new_end_date: extension.new_end_date.toISOString(),
      additional_cost: extension.additional_cost,
      message: extension.message,
      status: extension.status,
      payment_intent_id: extension.payment_intent_id,
      created_at: extension.created_at?.toISOString() || new Date().toISOString(),
      updated_at: extension.updated_at?.toISOString() || new Date().toISOString(),
    }))

    res.json({
      success: true,
      data: formattedExtensions,
    })
  } catch (error) {
    console.error('Error fetching rental extensions:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
})

/**
 * GET /api/rental-extensions/:id
 * Get a specific rental extension by ID
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

    const extension = await RentalExtension.findById(id).lean()

    if (!extension) {
      return res.status(404).json({
        success: false,
        error: 'Rental extension not found',
      })
    }

    // Format extension for API response
    const formattedExtension = {
      id: extension._id.toString(),
      rental_request_id: extension.rental_request_id,
      requested_by_email: extension.requested_by_email,
      new_end_date: extension.new_end_date.toISOString(),
      additional_cost: extension.additional_cost,
      message: extension.message,
      status: extension.status,
      payment_intent_id: extension.payment_intent_id,
      created_at: extension.created_at?.toISOString() || new Date().toISOString(),
      updated_at: extension.updated_at?.toISOString() || new Date().toISOString(),
    }

    res.json({
      success: true,
      data: formattedExtension,
    })
  } catch (error) {
    console.error('Error fetching rental extension:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
})

/**
 * POST /api/rental-extensions
 * Create a new rental extension request
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

    const { rental_request_id, requested_by_email, new_end_date, additional_cost, message, status } = req.body

    if (!rental_request_id) {
      return res.status(400).json({
        success: false,
        error: 'rental_request_id is required',
      })
    }

    if (!requested_by_email) {
      return res.status(400).json({
        success: false,
        error: 'requested_by_email is required',
      })
    }

    if (!new_end_date) {
      return res.status(400).json({
        success: false,
        error: 'new_end_date is required',
      })
    }

    if (additional_cost === undefined || additional_cost === null) {
      return res.status(400).json({
        success: false,
        error: 'additional_cost is required',
      })
    }

    // Create new rental extension
    const extension = new RentalExtension({
      rental_request_id,
      requested_by_email,
      new_end_date: new Date(new_end_date),
      additional_cost: parseFloat(additional_cost),
      message: message?.trim(),
      status: status || 'pending',
    })

    await extension.save()

    // Format extension for API response
    const formattedExtension = {
      id: extension._id.toString(),
      rental_request_id: extension.rental_request_id,
      requested_by_email: extension.requested_by_email,
      new_end_date: extension.new_end_date.toISOString(),
      additional_cost: extension.additional_cost,
      message: extension.message,
      status: extension.status,
      payment_intent_id: extension.payment_intent_id,
      created_at: extension.created_at?.toISOString() || new Date().toISOString(),
      updated_at: extension.updated_at?.toISOString() || new Date().toISOString(),
    }

    res.status(201).json({
      success: true,
      data: formattedExtension,
    })
  } catch (error) {
    console.error('Error creating rental extension:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
})

/**
 * PUT /api/rental-extensions/:id
 * Update a rental extension (e.g., approve, decline, add payment_intent_id)
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
    if (req.body.status !== undefined) {
      updateData.status = req.body.status
    }
    if (req.body.payment_intent_id !== undefined) {
      updateData.payment_intent_id = req.body.payment_intent_id
    }
    if (req.body.message !== undefined) {
      updateData.message = req.body.message?.trim()
    }
    if (req.body.new_end_date !== undefined) {
      updateData.new_end_date = new Date(req.body.new_end_date)
    }
    if (req.body.additional_cost !== undefined) {
      updateData.additional_cost = parseFloat(req.body.additional_cost)
    }

    const extension = await RentalExtension.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )

    if (!extension) {
      return res.status(404).json({
        success: false,
        error: 'Rental extension not found',
      })
    }

    // Format extension for API response
    const formattedExtension = {
      id: extension._id.toString(),
      rental_request_id: extension.rental_request_id,
      requested_by_email: extension.requested_by_email,
      new_end_date: extension.new_end_date.toISOString(),
      additional_cost: extension.additional_cost,
      message: extension.message,
      status: extension.status,
      payment_intent_id: extension.payment_intent_id,
      created_at: extension.created_at?.toISOString() || new Date().toISOString(),
      updated_at: extension.updated_at?.toISOString() || new Date().toISOString(),
    }

    res.json({
      success: true,
      data: formattedExtension,
    })
  } catch (error) {
    console.error('Error updating rental extension:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
})

/**
 * DELETE /api/rental-extensions/:id
 * Delete a rental extension
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

    const extension = await RentalExtension.findByIdAndDelete(id)

    if (!extension) {
      return res.status(404).json({
        success: false,
        error: 'Rental extension not found',
      })
    }

    res.json({
      success: true,
      message: 'Rental extension deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting rental extension:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
})

export default router
