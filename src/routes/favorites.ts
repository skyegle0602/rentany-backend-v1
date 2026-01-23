import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/clerk'
import Favorite from '../models/favorites'
import { isDatabaseConnected } from '../config/database'
import { getOrSyncUser } from '../services/userSync'

const router = Router()

/**
 * GET /api/favorites
 * Get favorites for a user
 * Query parameters:
 * - user_email: The user's email to get favorites for
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    if (!isDatabaseConnected()) {
      return res.status(503).json({
        success: false,
        error: 'Database is not available. Please try again in a moment.',
      })
    }

    const { user_email } = req.query

    if (!user_email) {
      return res.status(400).json({
        success: false,
        error: 'user_email query parameter is required',
      })
    }

    // Fetch favorites for the user
    const favorites = await Favorite.find({
      user_email: user_email as string,
    })
      .sort({ created_at: -1 })
      .lean()

    // Format for API response
    const formattedFavorites = favorites.map((fav) => ({
      id: fav._id.toString(),
      user_email: fav.user_email,
      item_id: fav.item_id,
      created_at: fav.created_at?.toISOString() || new Date().toISOString(),
    }))

    res.json({
      success: true,
      data: formattedFavorites,
    })
  } catch (error) {
    console.error('Error fetching favorites:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
})

/**
 * POST /api/favorites
 * Add an item to favorites
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

    const { item_id, user_email } = req.body

    // Validate required fields
    if (!item_id || !user_email) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: item_id, user_email',
      })
    }

    // Verify user exists
    const user = await getOrSyncUser(userId)
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      })
    }

    // Verify user_email matches authenticated user
    if (user.email !== user_email) {
      return res.status(403).json({
        success: false,
        error: 'Cannot add favorites for other users',
      })
    }

    // Check if favorite already exists
    const existingFavorite = await Favorite.findOne({
      user_email,
      item_id,
    })

    if (existingFavorite) {
      // Return existing favorite
      return res.json({
        success: true,
        data: {
          id: existingFavorite._id.toString(),
          user_email: existingFavorite.user_email,
          item_id: existingFavorite.item_id,
          created_at: existingFavorite.created_at?.toISOString() || new Date().toISOString(),
        },
      })
    }

    // Create new favorite
    const favorite = new Favorite({
      user_email,
      item_id,
    })

    await favorite.save()

    console.log(`✅ Added favorite: item ${item_id} for user ${user_email}`)

    // Format for API response
    const formattedFavorite = {
      id: favorite._id.toString(),
      user_email: favorite.user_email,
      item_id: favorite.item_id,
      created_at: favorite.created_at?.toISOString() || new Date().toISOString(),
    }

    res.json({
      success: true,
      data: formattedFavorite,
    })
  } catch (error) {
    console.error('Error creating favorite:', error)
    // Handle duplicate key error (unique constraint)
    if ((error as any).code === 11000) {
      return res.status(409).json({
        success: false,
        error: 'Item is already in favorites',
      })
    }
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
})

/**
 * DELETE /api/favorites
 * Remove an item from favorites by item_id and user_email
 * Requires authentication
 * Body: { item_id: string, user_email: string }
 */
router.delete('/', requireAuth, async (req: Request, res: Response) => {
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

    const { item_id, user_email } = req.body

    if (!item_id || !user_email) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: item_id, user_email',
      })
    }

    // Verify user owns this favorite
    const user = await getOrSyncUser(userId)
    if (!user || user.email !== user_email) {
      return res.status(403).json({
        success: false,
        error: 'Cannot delete favorites for other users',
      })
    }

    // Find and delete the favorite
    const favorite = await Favorite.findOneAndDelete({
      user_email,
      item_id,
    })

    // If favorite doesn't exist, that's okay - it's already deleted (idempotent operation)
    if (!favorite) {
      console.log(`ℹ️  Favorite for item ${item_id} by user ${user_email} was already deleted or doesn't exist`)
      return res.json({
        success: true,
        message: 'Favorite was already deleted or does not exist',
      })
    }

    console.log(`✅ Removed favorite for item ${item_id} by user ${user_email}`)

    res.json({
      success: true,
    })
  } catch (error) {
    console.error('Error deleting favorite:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
})

/**
 * DELETE /api/favorites/:id
 * Remove an item from favorites by ID
 * Requires authentication
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

    // Find the favorite
    const favorite = await Favorite.findById(id).lean()

    // If favorite doesn't exist, that's okay - it's already deleted (idempotent operation)
    if (!favorite) {
      console.log(`ℹ️  Favorite ${id} was already deleted or doesn't exist`)
      return res.json({
        success: true,
        message: 'Favorite was already deleted or does not exist',
      })
    }

    // Verify user owns this favorite
    const user = await getOrSyncUser(userId)
    if (!user || user.email !== favorite.user_email) {
      return res.status(403).json({
        success: false,
        error: 'Cannot delete favorites for other users',
      })
    }

    // Delete the favorite
    await Favorite.findByIdAndDelete(id)

    console.log(`✅ Removed favorite ${id} by user ${userId}`)

    res.json({
      success: true,
    })
  } catch (error) {
    console.error('Error deleting favorite:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
})

export default router
