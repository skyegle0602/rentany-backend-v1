import mongoose, { Schema, Document, Model } from 'mongoose'

/**
 * Dispute interface
 */
export interface IDispute extends Document {
  rental_request_id: string // Rental request this dispute is about
  filed_by_email: string // Email of the person filing the dispute
  against_email: string // Email of the person the dispute is against
  reason: string // Reason for the dispute
  description: string // Detailed description
  status: 'open' | 'under_review' | 'resolved' | 'closed' // Status of the dispute
  evidence_urls?: string[] // URLs to evidence files
  resolution?: string // Resolution text
  decision?: string // Admin decision
  refund_to_renter?: number // Amount to refund to renter
  charge_to_owner?: number // Amount to charge to owner
  admin_notes?: string // Admin notes
  created_date: Date
  resolved_date?: Date
}

/**
 * Dispute schema for MongoDB
 */
const DisputeSchema = new Schema<IDispute>(
  {
    rental_request_id: {
      type: String,
      required: true,
      index: true,
    },
    filed_by_email: {
      type: String,
      required: true,
      index: true,
      lowercase: true,
      trim: true,
    },
    against_email: {
      type: String,
      required: true,
      index: true,
      lowercase: true,
      trim: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['open', 'under_review', 'resolved', 'closed'],
      default: 'open',
      index: true,
    },
    evidence_urls: [{
      type: String,
    }],
    resolution: {
      type: String,
      trim: true,
    },
    decision: {
      type: String,
      trim: true,
    },
    refund_to_renter: {
      type: Number,
      min: 0,
    },
    charge_to_owner: {
      type: Number,
      min: 0,
    },
    admin_notes: {
      type: String,
      trim: true,
    },
    resolved_date: {
      type: Date,
    },
  },
  {
    timestamps: {
      createdAt: 'created_date',
      updatedAt: false, // We don't need updated_at for disputes
    },
  }
)

// Create indexes for better query performance
DisputeSchema.index({ rental_request_id: 1 })
DisputeSchema.index({ filed_by_email: 1 })
DisputeSchema.index({ against_email: 1 })
DisputeSchema.index({ status: 1 })
DisputeSchema.index({ created_date: -1 })

/**
 * Dispute model
 */
const Dispute: Model<IDispute> = mongoose.models.Dispute || mongoose.model<IDispute>('Dispute', DisputeSchema, 'disputes')

export default Dispute
