import { Router, Request, Response } from 'express'
import { requireAuth, getAuth } from '../middleware/clerk'
import { getOrSyncUser } from '../services/userSync'
import { isDatabaseConnected } from '../config/database'

const router = Router()

/**
 * GET /api/payouts
 * Get payouts for the current user
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!isDatabaseConnected()) {
      return res.status(503).json({
        success: false,
        error: 'Database is not available. Please try again in a moment.',
      })
    }

    // Get authenticated user using getAuth helper to avoid deprecation warnings
    const auth = getAuth(req)
    const userId = auth?.userId
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      })
    }

    const user = await getOrSyncUser(userId)
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      })
    }

    // For now, return empty payouts array
    // In a real system, you'd fetch from a payouts collection
    res.json({
      success: true,
      data: [],
    })
  } catch (error) {
    console.error('Error fetching payouts:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
})

export default router
