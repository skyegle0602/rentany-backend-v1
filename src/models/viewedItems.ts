import mongoose, { Schema, Document, Model } from 'mongoose'

/**
 * ViewedItem interface matching the data structure
 */
export interface IViewedItem extends Document {
  user_email: string
  item_id: string
  viewed_date: Date
  view_count: number
  
  // Timestamps
  created_at: Date
  updated_at: Date
}

/**
 * ViewedItem schema for MongoDB
 */
const ViewedItemSchema = new Schema<IViewedItem>(
  {
    user_email: {
      type: String,
      required: true,
      index: true,
    },
    item_id: {
      type: String,
      required: true,
      index: true,
    },
    viewed_date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    view_count: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  }
)

// Create compound index for efficient queries
ViewedItemSchema.index({ user_email: 1, item_id: 1 }, { unique: true })

const ViewedItem: Model<IViewedItem> = mongoose.models.ViewedItem || mongoose.model<IViewedItem>('ViewedItem', ViewedItemSchema)

export default ViewedItem
