import mongoose, { Schema, Document } from 'mongoose'

export interface IRentalExtension extends Document {
  rental_request_id: string
  requested_by_email: string
  new_end_date: Date
  additional_cost: number
  message?: string
  status: 'pending' | 'approved' | 'declined'
  payment_intent_id?: string
  created_at?: Date
  updated_at?: Date
}

const RentalExtensionSchema = new Schema<IRentalExtension>(
  {
    rental_request_id: {
      type: String,
      required: true,
      index: true,
    },
    requested_by_email: {
      type: String,
      required: true,
      index: true,
    },
    new_end_date: {
      type: Date,
      required: true,
    },
    additional_cost: {
      type: Number,
      required: true,
      min: 0,
    },
    message: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'declined'],
      default: 'pending',
      index: true,
    },
    payment_intent_id: {
      type: String,
    },
  },
  {
    timestamps: true,
    collection: 'rental_extensions',
  }
)

// Indexes for efficient queries
RentalExtensionSchema.index({ rental_request_id: 1, status: 1 })
RentalExtensionSchema.index({ requested_by_email: 1, status: 1 })

const RentalExtension = mongoose.models.RentalExtension || mongoose.model<IRentalExtension>('RentalExtension', RentalExtensionSchema)

export default RentalExtension
