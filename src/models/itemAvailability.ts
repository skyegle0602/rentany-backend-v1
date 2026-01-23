import mongoose, { Schema, Document } from 'mongoose'

export interface IItemAvailability extends Document {
  item_id: string
  blocked_start_date: Date
  blocked_end_date: Date
  reason: string
  created_at?: Date
  updated_at?: Date
}

const ItemAvailabilitySchema = new Schema<IItemAvailability>(
  {
    item_id: {
      type: String,
      required: true,
      index: true,
    },
    blocked_start_date: {
      type: Date,
      required: true,
    },
    blocked_end_date: {
      type: Date,
      required: true,
    },
    reason: {
      type: String,
      required: true,
      enum: ['personal_use', 'maintenance', 'repair', 'rented', 'other'],
      default: 'personal_use',
    },
  },
  {
    timestamps: true,
    collection: 'item_availability',
  }
)

// Index for efficient queries
ItemAvailabilitySchema.index({ item_id: 1, blocked_start_date: 1, blocked_end_date: 1 })

const ItemAvailability = mongoose.model<IItemAvailability>('ItemAvailability', ItemAvailabilitySchema)

export default ItemAvailability
