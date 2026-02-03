import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/clerk'
import Message from '../models/messages'
import { getAuth } from '../middleware/clerk'

const router = Router()

/**
 * GET /api/messages
 * Get messages for a rental request
 * Query parameter: ?rental_request_id=xxx
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

    if (!rental_request_id || typeof rental_request_id !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'rental_request_id query parameter is required',
      })
    }

    const messages = await Message.find({
      rental_request_id: rental_request_id,
    })
      .sort({ created_at: 1 }) // Sort by creation date ascending (oldest first)
      .lean()

    // Format messages for API response
    const formattedMessages = messages.map((message) => ({
      id: message._id.toString(),
      rental_request_id: message.rental_request_id,
      sender_email: message.sender_email,
      content: message.content,
      attachments: message.attachments || [],
      message_type: message.message_type || 'text',
      created_date: message.created_at?.toISOString() || new Date().toISOString(),
      is_read: message.is_read || false,
      read_at: message.read_at?.toISOString(),
    }))

    res.json({
      success: true,
      data: formattedMessages,
    })
  } catch (error) {
    console.error('Error fetching messages:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
})

/**
 * POST /api/messages
 * Create a new message
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

    const { rental_request_id, sender_email, content, attachments, message_type } = req.body

    if (!rental_request_id) {
      return res.status(400).json({
        success: false,
        error: 'rental_request_id is required',
      })
    }

    if (!sender_email) {
      return res.status(400).json({
        success: false,
        error: 'sender_email is required',
      })
    }

    // Create new message
    const message = new Message({
      rental_request_id,
      sender_email,
      content: content || '',
      attachments: attachments || [],
      message_type: message_type || 'text',
      is_read: false,
    })

    await message.save()

    // Format message for API response
    const formattedMessage = {
      id: message._id.toString(),
      rental_request_id: message.rental_request_id,
      sender_email: message.sender_email,
      content: message.content,
      attachments: message.attachments || [],
      message_type: message.message_type || 'text',
      created_date: message.created_at?.toISOString() || new Date().toISOString(),
      is_read: message.is_read || false,
      read_at: message.read_at?.toISOString(),
    }

    res.status(201).json({
      success: true,
      data: formattedMessage,
    })
  } catch (error) {
    console.error('Error creating message:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
})

/**
 * PUT /api/messages/:id
 * Update a message (e.g., mark as read)
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
    if (req.body.is_read !== undefined) {
      updateData.is_read = req.body.is_read
    }
    if (req.body.read_at !== undefined) {
      updateData.read_at = req.body.read_at ? new Date(req.body.read_at) : null
    }
    if (req.body.content !== undefined) {
      updateData.content = req.body.content?.trim()
    }

    const message = await Message.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )

    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Message not found',
      })
    }

    // Format message for API response
    const formattedMessage = {
      id: message._id.toString(),
      rental_request_id: message.rental_request_id,
      sender_email: message.sender_email,
      content: message.content,
      attachments: message.attachments || [],
      message_type: message.message_type || 'text',
      created_date: message.created_at?.toISOString() || new Date().toISOString(),
      is_read: message.is_read || false,
      read_at: message.read_at?.toISOString(),
    }

    res.json({
      success: true,
      data: formattedMessage,
    })
  } catch (error) {
    console.error('Error updating message:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
})

/**
 * DELETE /api/messages/:id
 * Delete a message
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

    const message = await Message.findByIdAndDelete(id)

    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Message not found',
      })
    }

    res.json({
      success: true,
      message: 'Message deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting message:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
})

export default router
