import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/clerk'
import Review, { IReview } from '../models/reviews'
import { isDatabaseConnected } from '../config/database'
import { getOrSyncUser } from '../services/userSync'

const router = Router()

/**
 * GET /api/reviews
 * Get reviews with optional filters
 * Query parameters:
 * - item_id: Filter by item ID
 * - user_id: Filter by user ID (reviewee_id)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    if (!isDatabaseConnected()) {
      return res.status(503).json({
        success: false,
        error: 'Database is not available. Please try again in a moment.',
      })
    }

    const { item_id, user_id } = req.query

    // Build query
    const query: any = {}
    if (item_id) {
      query.item_id = item_id
    }
    if (user_id) {
      query.reviewee_id = user_id
    }

    // Fetch reviews
    const reviews = await Review.find(query)
      .sort({ created_date: -1 }) // Most recent first
      .lean()

    // Format reviews for API response
    const formattedReviews = reviews.map((review) => ({
      id: review._id.toString(),
      item_id: review.item_id,
      reviewer_email: review.reviewer_email,
      rating: review.rating,
      comment: review.comment,
      created_date: review.created_date?.toISOString() || new Date().toISOString(),
      review_type: review.review_type,
      images: review.images || [],
    }))

    res.json({
      success: true,
      data: formattedReviews,
    })
  } catch (error) {
    console.error('Error fetching reviews:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
})

/**
 * POST /api/reviews
 * Create a new review
 * Requires authentication
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

    const { item_id, rating, comment, review_type, images, reviewee_id } = req.body

    // Validate required fields
    if (!item_id || !rating || !comment || !review_type) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: item_id, rating, comment, review_type',
      })
    }

    // Validate rating
    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: 'Rating must be between 1 and 5',
      })
    }

    // Validate review_type
    if (!['for_owner', 'for_renter'].includes(review_type)) {
      return res.status(400).json({
        success: false,
        error: 'review_type must be either "for_owner" or "for_renter"',
      })
    }

    // Get reviewer email from authenticated user
    const user = await getOrSyncUser(userId)
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      })
    }
    const reviewer_email = user.email

    // Create review
    const review = new Review({
      item_id,
      reviewer_email,
      reviewee_id,
      rating,
      comment,
      review_type,
      images: images || [],
    })

    await review.save()

    res.json({
      success: true,
      data: {
        id: review._id.toString(),
        item_id: review.item_id,
        reviewer_email: review.reviewer_email,
        rating: review.rating,
        comment: review.comment,
        created_date: review.created_date?.toISOString() || new Date().toISOString(),
        review_type: review.review_type,
        images: review.images || [],
      },
    })
  } catch (error) {
    console.error('Error creating review:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
})

export default router
