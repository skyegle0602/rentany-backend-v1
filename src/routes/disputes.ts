import { Router, Request, Response } from 'express'
import { requireAuth, getAuth } from '../middleware/clerk'
import Dispute, { IDispute } from '../models/disputes'
import { isDatabaseConnected } from '../config/database'
import User from '../models/users'

const router = Router()

/**
 * GET /api/disputes
 * Get disputes with optional filters
 * Query parameters:
 * - rental_request_id: Filter by rental request ID
 * - filed_by_email: Filter by filer's email
 * - against_email: Filter by person disputed against
 * - status: Filter by status
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!isDatabaseConnected()) {
      return res.status(503).json({
        success: false,
        error: 'Database is not available. Please try again in a moment.',
      })
    }

    const auth = getAuth(req)
    const userId = auth?.userId

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    const { rental_request_id, filed_by_email, against_email, status } = req.query

    // Build query
    const query: any = {}
    if (rental_request_id) {
      query.rental_request_id = rental_request_id
    }
    if (filed_by_email) {
      query.filed_by_email = filed_by_email
    }
    if (against_email) {
      query.against_email = against_email
    }
    if (status) {
      query.status = status
    }

    // Get current user to check if they're an admin
    const currentUser = await User.findOne({ clerk_id: userId })
    if (!currentUser) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }

    // If not admin, only show disputes where user is involved
    if (currentUser.role !== 'admin') {
      query.$or = [
        { filed_by_email: currentUser.email },
        { against_email: currentUser.email }
      ]
    }

    // Fetch disputes
    const disputes = await Dispute.find(query)
      .sort({ created_date: -1 }) // Most recent first
      .lean()

    // Format disputes for API response
    const formattedDisputes = disputes.map((dispute) => ({
      id: dispute._id.toString(),
      rental_request_id: dispute.rental_request_id,
      filed_by_email: dispute.filed_by_email,
      against_email: dispute.against_email,
      reason: dispute.reason,
      description: dispute.description,
      status: dispute.status,
      evidence_urls: dispute.evidence_urls || [],
      resolution: dispute.resolution,
      decision: dispute.decision,
      refund_to_renter: dispute.refund_to_renter,
      charge_to_owner: dispute.charge_to_owner,
      admin_notes: dispute.admin_notes,
      created_date: dispute.created_date?.toISOString() || new Date().toISOString(),
      resolved_date: dispute.resolved_date?.toISOString(),
    }))

    res.json({
      success: true,
      data: formattedDisputes,
    })
  } catch (error) {
    console.error('Error fetching disputes:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
})

/**
 * POST /api/disputes
 * Create a new dispute
 */
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!isDatabaseConnected()) {
      return res.status(503).json({
        success: false,
        error: 'Database is not available. Please try again in a moment.',
      })
    }

    const auth = getAuth(req)
    const userId = auth?.userId

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    const {
      rental_request_id,
      filed_by_email,
      against_email,
      reason,
      description,
      evidence_urls,
    } = req.body

    // Basic validation
    if (!rental_request_id || !filed_by_email || !against_email || !reason || !description) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: rental_request_id, filed_by_email, against_email, reason, description',
      })
    }

    // Get current user to verify they're the one filing
    const currentUser = await User.findOne({ clerk_id: userId })
    if (!currentUser) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }

    // Ensure the filed_by_email matches the authenticated user's email
    if (currentUser.email !== filed_by_email) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You can only file disputes as yourself',
      })
    }

    // Create new dispute
    const newDispute = new Dispute({
      rental_request_id,
      filed_by_email,
      against_email,
      reason,
      description,
      evidence_urls: evidence_urls || [],
      status: 'open',
    })

    await newDispute.save()

    res.status(201).json({
      success: true,
      data: {
        id: newDispute._id.toString(),
        rental_request_id: newDispute.rental_request_id,
        filed_by_email: newDispute.filed_by_email,
        against_email: newDispute.against_email,
        reason: newDispute.reason,
        description: newDispute.description,
        status: newDispute.status,
        evidence_urls: newDispute.evidence_urls || [],
        resolution: newDispute.resolution,
        decision: newDispute.decision,
        refund_to_renter: newDispute.refund_to_renter,
        charge_to_owner: newDispute.charge_to_owner,
        admin_notes: newDispute.admin_notes,
        created_date: newDispute.created_date.toISOString(),
        resolved_date: newDispute.resolved_date?.toISOString(),
      },
    })
  } catch (error) {
    console.error('Error creating dispute:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
})

/**
 * PUT /api/disputes/:id
 * Update a dispute
 * Only admins can update disputes, or users can update their own disputes (limited fields)
 */
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    if (!isDatabaseConnected()) {
      return res.status(503).json({
        success: false,
        error: 'Database is not available. Please try again in a moment.',
      })
    }

    const auth = getAuth(req)
    const userId = auth?.userId

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    const { id } = req.params
    const updates = req.body

    // Find the dispute
    const dispute = await Dispute.findById(id)
    if (!dispute) {
      return res.status(404).json({ success: false, error: 'Dispute not found' })
    }

    // Get current user
    const currentUser = await User.findOne({ clerk_id: userId })
    if (!currentUser) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }

    // Check permissions
    const isAdmin = currentUser.role === 'admin'
    const isFiler = dispute.filed_by_email === currentUser.email

    // Only admins can update all fields, filers can only update evidence_urls
    if (!isAdmin && !isFiler) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You do not have permission to update this dispute',
      })
    }

    // If not admin, only allow updating evidence_urls
    if (!isAdmin) {
      if (Object.keys(updates).some(key => key !== 'evidence_urls')) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: You can only update evidence_urls. Contact an admin for other changes.',
        })
      }
    }

    // If status is being changed to resolved/closed, set resolved_date
    if (updates.status && ['resolved', 'closed'].includes(updates.status) && !dispute.resolved_date) {
      updates.resolved_date = new Date()
    }

    // Apply updates
    Object.assign(dispute, updates)
    await dispute.save()

    res.json({
      success: true,
      data: {
        id: dispute._id.toString(),
        rental_request_id: dispute.rental_request_id,
        filed_by_email: dispute.filed_by_email,
        against_email: dispute.against_email,
        reason: dispute.reason,
        description: dispute.description,
        status: dispute.status,
        evidence_urls: dispute.evidence_urls || [],
        resolution: dispute.resolution,
        decision: dispute.decision,
        refund_to_renter: dispute.refund_to_renter,
        charge_to_owner: dispute.charge_to_owner,
        admin_notes: dispute.admin_notes,
        created_date: dispute.created_date.toISOString(),
        resolved_date: dispute.resolved_date?.toISOString(),
      },
    })
  } catch (error) {
    console.error('Error updating dispute:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
})

export default router
