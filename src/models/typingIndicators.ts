import mongoose, { Schema, Document } from 'mongoose'

export interface ITypingIndicator extends Document {
  rental_request_id: string
  user_email: string
  is_typing: boolean
  expires_at: Date
  created_at?: Date
  updated_at?: Date
}

const TypingIndicatorSchema = new Schema<ITypingIndicator>(
  {
    rental_request_id: {
      type: String,
      required: true,
      index: true,
    },
    user_email: {
      type: String,
      required: true,
      index: true,
    },
    is_typing: {
      type: Boolean,
      default: false,
    },
    expires_at: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 }, // Auto-delete expired documents
    },
  },
  {
    timestamps: true,
    collection: 'typing_indicators',
  }
)

// Compound index for efficient queries
TypingIndicatorSchema.index({ rental_request_id: 1, user_email: 1 })

const TypingIndicator = mongoose.models.TypingIndicator || mongoose.model<ITypingIndicator>('TypingIndicator', TypingIndicatorSchema)

export default TypingIndicator
