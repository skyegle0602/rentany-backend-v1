import { Router, Request, Response } from 'express'
import { requireAuth, getAuth } from '../middleware/clerk'
import { getOrSyncUser } from '../services/userSync'
import { isDatabaseConnected } from '../config/database'

const router = Router()

/**
 * GET /api/wallet
 * Get wallet data for the current user
 * Returns total earnings, completed transactions, held transactions
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

    // For now, return default wallet data
    // In a real system, you'd calculate this from actual rental transactions
    const walletData = {
      totalEarnings: 0,
      completedTransactions: [],
      heldTransactions: [],
    }

    res.json({
      success: true,
      data: walletData,
    })
  } catch (error) {
    console.error('Error fetching wallet data:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
})

export default router
