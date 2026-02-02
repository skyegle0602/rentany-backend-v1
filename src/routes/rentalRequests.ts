import { Router, Request, Response } from 'express'
import { requireAuth, getAuth } from '../middleware/clerk'
import RentalRequest from '../models/rentalRequests'
import ItemAvailability from '../models/itemAvailability'
import { getOrSyncUser } from '../services/userSync'

const router = Router()

/**
 * GET /api/rental-requests
 * Get rental requests for the current user
 * Query params: renter_email, owner_email, sort
 * Requires authentication
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    // Get authenticated user using getAuth helper to avoid deprecation warnings
    const auth = getAuth(req)
    const userId = auth?.userId

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      })
    }

    // Build query based on query parameters
    const query: any = {}
    
    if (req.query.renter_email) {
      query.renter_email = req.query.renter_email
    }
    
    if (req.query.owner_email) {
      query.owner_email = req.query.owner_email
    }

    // Build sort object
    let sort: any = { updated_at: -1 } // Default sort by updated_at descending
    if (req.query.sort) {
      const sortParam = req.query.sort as string
      if (sortParam.startsWith('-')) {
        // Descending sort
        const field = sortParam.substring(1)
        sort = { [field]: -1 }
      } else {
        // Ascending sort
        sort = { [sortParam]: 1 }
      }
    }

    const requests = await RentalRequest.find(query).sort(sort)

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
    }))

    return res.json({
      success: true,
      data: formattedRequests,
    })
  } catch (error) {
    console.error('Error fetching rental requests:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch rental requests',
    })
  }
})

/**
 * POST /api/rental-requests/validate
 * Validate if dates are available for rental
 * Supports both date ranges and individual dates
 * Requires authentication
 */
router.post('/validate', requireAuth, async (req: Request, res: Response) => {
  try {
    const auth = getAuth(req)
    const userId = auth?.userId

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      })
    }

    const { item_id, start_date, end_date, selected_dates } = req.body

    if (!item_id) {
      return res.status(400).json({
        success: false,
        error: 'item_id is required',
      })
    }

    // Get user to check verification status
    const user = await getOrSyncUser(userId)
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      })
    }

    // Check if user is verified or admin
    if (user.role !== 'admin' && user.verification_status !== 'verified') {
      return res.json({
        success: true,
        data: {
          available: false,
          verification_required: true,
        },
      })
    }

    // Determine dates to check
    let datesToCheck: Date[] = []

    if (selected_dates && Array.isArray(selected_dates) && selected_dates.length > 0) {
      // Individual dates selection
      datesToCheck = selected_dates.map((d: string) => new Date(d))
    } else if (start_date && end_date) {
      // Date range selection
      const start = new Date(start_date)
      const end = new Date(end_date)
      // Generate all dates in range
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        datesToCheck.push(new Date(d))
      }
    } else {
      return res.status(400).json({
        success: false,
        error: 'Either start_date/end_date or selected_dates array is required',
      })
    }

    // Check for conflicts with existing blocked dates
    const blockedDates = await ItemAvailability.find({
      item_id,
    })

    // Check each date against blocked ranges
    for (const checkDate of datesToCheck) {
      const dateStr = checkDate.toISOString().split('T')[0] // Get YYYY-MM-DD format
      
      for (const block of blockedDates) {
        const blockStart = new Date(block.blocked_start_date)
        const blockEnd = new Date(block.blocked_end_date)
        
        // Normalize to date-only (remove time)
        blockStart.setHours(0, 0, 0, 0)
        blockEnd.setHours(0, 0, 0, 0)
        checkDate.setHours(0, 0, 0, 0)
        
        // Check if date falls within blocked range
        if (checkDate >= blockStart && checkDate <= blockEnd) {
          return res.json({
            success: true,
            data: {
              available: false,
            },
          })
        }
      }
    }

    // All dates are available
    return res.json({
      success: true,
      data: {
        available: true,
      },
    })
  } catch (error) {
    console.error('Error validating rental dates:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to validate dates',
    })
  }
})

/**
 * POST /api/rental-requests
 * Create a new rental request
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

    const { item_id, renter_email, owner_email, start_date, end_date, total_amount, message, status } = req.body

    // Validate required fields
    if (!item_id || !renter_email || !owner_email || !start_date || !end_date || total_amount === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: item_id, renter_email, owner_email, start_date, end_date, total_amount',
      })
    }

    // Verify user exists and is verified (or admin)
    // At MVP stage: Only users with Stripe payment integration can book/rent items
    const user = await getOrSyncUser(userId)
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      })
    }

    // Check if user is verified or admin
    if (user.role !== 'admin' && user.verification_status !== 'verified') {
      return res.status(403).json({
        success: false,
        error: 'Stripe payment integration required to book items. Please connect your payment account.',
      })
    }

    // Create rental request
    const rentalRequest = new RentalRequest({
      item_id,
      renter_email,
      owner_email,
      start_date: new Date(start_date),
      end_date: new Date(end_date),
      total_amount: parseFloat(total_amount),
      message: message?.trim(),
      status: status || 'pending',
    })

    await rentalRequest.save()

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
    }

    return res.status(201).json({
      success: true,
      data: formattedRequest,
    })
  } catch (error) {
    console.error('Error creating rental request:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to create rental request',
    })
  }
})

/**
 * PUT /api/rental-requests/:id
 * Update a rental request
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
    if (req.body.start_date !== undefined) {
      updateData.start_date = new Date(req.body.start_date)
    }
    if (req.body.end_date !== undefined) {
      updateData.end_date = new Date(req.body.end_date)
    }
    if (req.body.total_amount !== undefined) {
      updateData.total_amount = parseFloat(req.body.total_amount)
    }
    if (req.body.message !== undefined) {
      updateData.message = req.body.message?.trim()
    }

    const rentalRequest = await RentalRequest.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )

    if (!rentalRequest) {
      return res.status(404).json({
        success: false,
        error: 'Rental request not found',
      })
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
    }

    return res.json({
      success: true,
      data: formattedRequest,
    })
  } catch (error) {
    console.error('Error updating rental request:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to update rental request',
    })
  }
})

/**
 * DELETE /api/rental-requests/:id
 * Delete a rental request
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

    const rentalRequest = await RentalRequest.findByIdAndDelete(id)

    if (!rentalRequest) {
      return res.status(404).json({
        success: false,
        error: 'Rental request not found',
      })
    }

    return res.json({
      success: true,
      message: 'Rental request deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting rental request:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to delete rental request',
    })
  }
})

export default router
