import mongoose, { Schema, Document } from 'mongoose'

export interface IDamageReport {
  severity: 'minor' | 'moderate' | 'severe'
  description: string
  photo_url?: string
}

export interface IConditionReport extends Document {
  rental_request_id: string
  report_type: 'pickup' | 'return'
  reported_by_email: string
  condition_photos?: string[]
  notes?: string
  damages_reported?: IDamageReport[]
  signature?: string
  created_at?: Date
  updated_at?: Date
}

const ConditionReportSchema = new Schema<IConditionReport>(
  {
    rental_request_id: {
      type: String,
      required: true,
      index: true,
    },
    report_type: {
      type: String,
      enum: ['pickup', 'return'],
      required: true,
      index: true,
    },
    reported_by_email: {
      type: String,
      required: true,
      index: true,
    },
    condition_photos: {
      type: [String],
      default: [],
    },
    notes: {
      type: String,
      trim: true,
    },
    damages_reported: [
      {
        severity: {
          type: String,
          enum: ['minor', 'moderate', 'severe'],
          required: true,
        },
        description: {
          type: String,
          required: true,
        },
        photo_url: {
          type: String,
        },
      },
    ],
    signature: {
      type: String,
    },
  },
  {
    timestamps: true,
    collection: 'condition_reports',
  }
)

// Indexes for efficient queries
ConditionReportSchema.index({ rental_request_id: 1, report_type: 1 })
ConditionReportSchema.index({ reported_by_email: 1 })

const ConditionReport = mongoose.models.ConditionReport || mongoose.model<IConditionReport>('ConditionReport', ConditionReportSchema)

export default ConditionReport
