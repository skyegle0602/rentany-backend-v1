import mongoose, { Schema, Document, Model } from 'mongoose'

/**
 * Review interface
 */
export interface IReview extends Document {
  item_id: string // Item being reviewed
  reviewer_email: string // Email of the person writing the review
  reviewee_id?: string // MongoDB user ID of the person being reviewed (optional)
  rating: number // Rating from 1 to 5
  comment: string // Review comment
  review_type: 'for_owner' | 'for_renter' // Type of review
  images?: string[] // Optional images attached to review
  created_date: Date
  updated_at: Date
}

/**
 * Review schema for MongoDB
 */
const ReviewSchema = new Schema<IReview>(
  {
    item_id: {
      type: String,
      required: true,
      index: true,
    },
    reviewer_email: {
      type: String,
      required: true,
      index: true,
      lowercase: true,
      trim: true,
    },
    reviewee_id: {
      type: String,
      index: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      required: true,
      trim: true,
    },
    review_type: {
      type: String,
      enum: ['for_owner', 'for_renter'],
      required: true,
    },
    images: [{
      type: String,
    }],
  },
  {
    timestamps: {
      createdAt: 'created_date',
      updatedAt: 'updated_at',
    },
  }
)

// Create indexes for better query performance
ReviewSchema.index({ item_id: 1 })
ReviewSchema.index({ reviewer_email: 1 })
ReviewSchema.index({ reviewee_id: 1 })
ReviewSchema.index({ review_type: 1 })

/**
 * Review model
 */
const Review: Model<IReview> = mongoose.models.Review || mongoose.model<IReview>('Review', ReviewSchema, 'reviews')

export default Review
