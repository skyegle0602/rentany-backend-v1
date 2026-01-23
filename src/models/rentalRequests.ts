import mongoose, { Schema, Document } from 'mongoose'

export interface IRentalRequest extends Document {
  item_id: string
  renter_email: string
  owner_email: string
  status: 'pending' | 'approved' | 'declined' | 'completed' | 'cancelled' | 'paid' | 'inquiry'
  start_date: Date
  end_date: Date
  total_amount: number
  message?: string
  created_at?: Date
  updated_at?: Date
}

const RentalRequestSchema = new Schema<IRentalRequest>(
  {
    item_id: {
      type: String,
      required: true,
      index: true,
    },
    renter_email: {
      type: String,
      required: true,
      index: true,
    },
    owner_email: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'declined', 'completed', 'cancelled', 'paid', 'inquiry'],
      default: 'pending',
      index: true,
    },
    start_date: {
      type: Date,
      required: true,
    },
    end_date: {
      type: Date,
      required: true,
    },
    total_amount: {
      type: Number,
      required: true,
      min: 0,
    },
    message: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    collection: 'rental_requests',
  }
)

// Indexes for efficient queries
RentalRequestSchema.index({ renter_email: 1, updated_at: -1 })
RentalRequestSchema.index({ owner_email: 1, updated_at: -1 })
RentalRequestSchema.index({ item_id: 1 })

const RentalRequest = mongoose.model<IRentalRequest>('RentalRequest', RentalRequestSchema)

export default RentalRequest
