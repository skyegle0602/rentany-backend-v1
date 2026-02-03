import { Router, Request, Response } from 'express'
import { requireAuth } from '../middleware/clerk'
import ConditionReport from '../models/conditionReports'
import { getAuth } from '../middleware/clerk'

const router = Router()

/**
 * GET /api/condition-reports
 * Get condition reports
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

    const reports = await ConditionReport.find(query)
      .sort({ created_at: -1 }) // Sort by creation date descending (newest first)
      .lean()

    // Format reports for API response
    const formattedReports = reports.map((report) => ({
      id: report._id.toString(),
      rental_request_id: report.rental_request_id,
      report_type: report.report_type,
      reported_by_email: report.reported_by_email,
      condition_photos: report.condition_photos || [],
      notes: report.notes,
      damages_reported: report.damages_reported || [],
      signature: report.signature,
      created_date: report.created_at?.toISOString() || new Date().toISOString(),
      created_at: report.created_at?.toISOString() || new Date().toISOString(),
      updated_at: report.updated_at?.toISOString() || new Date().toISOString(),
    }))

    res.json({
      success: true,
      data: formattedReports,
    })
  } catch (error) {
    console.error('Error fetching condition reports:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
})

/**
 * GET /api/condition-reports/:id
 * Get a specific condition report by ID
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

    const report = await ConditionReport.findById(id).lean()

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Condition report not found',
      })
    }

    // Format report for API response
    const formattedReport = {
      id: report._id.toString(),
      rental_request_id: report.rental_request_id,
      report_type: report.report_type,
      reported_by_email: report.reported_by_email,
      condition_photos: report.condition_photos || [],
      notes: report.notes,
      damages_reported: report.damages_reported || [],
      signature: report.signature,
      created_date: report.created_at?.toISOString() || new Date().toISOString(),
      created_at: report.created_at?.toISOString() || new Date().toISOString(),
      updated_at: report.updated_at?.toISOString() || new Date().toISOString(),
    }

    res.json({
      success: true,
      data: formattedReport,
    })
  } catch (error) {
    console.error('Error fetching condition report:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
})

/**
 * POST /api/condition-reports
 * Create a new condition report
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

    const { rental_request_id, report_type, reported_by_email, condition_photos, notes, damages_reported, signature } = req.body

    if (!rental_request_id) {
      return res.status(400).json({
        success: false,
        error: 'rental_request_id is required',
      })
    }

    if (!report_type || !['pickup', 'return'].includes(report_type)) {
      return res.status(400).json({
        success: false,
        error: 'report_type is required and must be "pickup" or "return"',
      })
    }

    if (!reported_by_email) {
      return res.status(400).json({
        success: false,
        error: 'reported_by_email is required',
      })
    }

    // Create new condition report
    const report = new ConditionReport({
      rental_request_id,
      report_type,
      reported_by_email,
      condition_photos: condition_photos || [],
      notes: notes?.trim(),
      damages_reported: damages_reported || [],
      signature: signature,
    })

    await report.save()

    // Format report for API response
    const formattedReport = {
      id: report._id.toString(),
      rental_request_id: report.rental_request_id,
      report_type: report.report_type,
      reported_by_email: report.reported_by_email,
      condition_photos: report.condition_photos || [],
      notes: report.notes,
      damages_reported: report.damages_reported || [],
      signature: report.signature,
      created_date: report.created_at?.toISOString() || new Date().toISOString(),
      created_at: report.created_at?.toISOString() || new Date().toISOString(),
      updated_at: report.updated_at?.toISOString() || new Date().toISOString(),
    }

    res.status(201).json({
      success: true,
      data: formattedReport,
    })
  } catch (error) {
    console.error('Error creating condition report:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
})

/**
 * PUT /api/condition-reports/:id
 * Update a condition report
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
    if (req.body.condition_photos !== undefined) {
      updateData.condition_photos = req.body.condition_photos
    }
    if (req.body.notes !== undefined) {
      updateData.notes = req.body.notes?.trim()
    }
    if (req.body.damages_reported !== undefined) {
      updateData.damages_reported = req.body.damages_reported
    }
    if (req.body.signature !== undefined) {
      updateData.signature = req.body.signature
    }

    const report = await ConditionReport.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Condition report not found',
      })
    }

    // Format report for API response
    const formattedReport = {
      id: report._id.toString(),
      rental_request_id: report.rental_request_id,
      report_type: report.report_type,
      reported_by_email: report.reported_by_email,
      condition_photos: report.condition_photos || [],
      notes: report.notes,
      damages_reported: report.damages_reported || [],
      signature: report.signature,
      created_date: report.created_at?.toISOString() || new Date().toISOString(),
      created_at: report.created_at?.toISOString() || new Date().toISOString(),
      updated_at: report.updated_at?.toISOString() || new Date().toISOString(),
    }

    res.json({
      success: true,
      data: formattedReport,
    })
  } catch (error) {
    console.error('Error updating condition report:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
})

/**
 * DELETE /api/condition-reports/:id
 * Delete a condition report
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

    const report = await ConditionReport.findByIdAndDelete(id)

    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Condition report not found',
      })
    }

    res.json({
      success: true,
      message: 'Condition report deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting condition report:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
})

export default router
