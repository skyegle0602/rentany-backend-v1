import mongoose, { Schema, Document } from 'mongoose'

export interface IMessage extends Document {
  rental_request_id: string
  sender_email: string
  content?: string
  attachments?: Array<{
    type: 'image' | 'document'
    url: string
    name?: string
    size?: number
  }>
  message_type?: string
  is_read?: boolean
  read_at?: Date
  created_at?: Date
  updated_at?: Date
}

const MessageSchema = new Schema<IMessage>(
  {
    rental_request_id: {
      type: String,
      required: true,
      index: true,
    },
    sender_email: {
      type: String,
      required: true,
      index: true,
    },
    content: {
      type: String,
      trim: true,
    },
    attachments: [
      {
        type: {
          type: String,
          enum: ['image', 'document'],
        },
        url: String,
        name: String,
        size: Number,
      },
    ],
    message_type: {
      type: String,
      default: 'text',
    },
    is_read: {
      type: Boolean,
      default: false,
    },
    read_at: {
      type: Date,
    },
  },
  {
    timestamps: true,
    collection: 'messages',
  }
)

// Indexes for efficient queries
MessageSchema.index({ rental_request_id: 1, created_at: -1 })
MessageSchema.index({ sender_email: 1, is_read: 1 })

const Message = mongoose.models.Message || mongoose.model<IMessage>('Message', MessageSchema)

export default Message
