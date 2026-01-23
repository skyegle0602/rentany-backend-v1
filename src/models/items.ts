import mongoose, { Schema, Document, Model } from 'mongoose'

/**
 * Item interface matching the data structure
 */
export interface IItem extends Document {
  owner_id: string // Clerk user ID of the item owner
  title: string
  description: string
  category: string
  daily_rate: number
  pricing_tiers?: Array<{
    days: number
    price: number
  }>
  deposit?: number
  condition: 'excellent' | 'good' | 'fair' | 'poor'
  location: string
  street_address?: string
  postcode?: string
  country?: string
  lat?: number
  lng?: number
  show_on_map: boolean
  min_rental_days: number
  max_rental_days: number
  notice_period_hours: number
  instant_booking: boolean
  same_day_pickup: boolean
  delivery_options: string[]
  delivery_fee?: number
  delivery_radius?: number
  images: string[]
  videos?: string[]
  availability: boolean
  status?: 'active' | 'inactive' | 'pending' | 'sold'
  
  // Timestamps
  created_at: Date
  updated_at: Date
}

/**
 * Item schema for MongoDB
 */
const ItemSchema = new Schema<IItem>(
  {
    owner_id: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    daily_rate: {
      type: Number,
      required: true,
      min: 0,
    },
    pricing_tiers: [{
      days: {
        type: Number,
        required: true,
        min: 1,
      },
      price: {
        type: Number,
        required: true,
        min: 0,
      },
    }],
    deposit: {
      type: Number,
      min: 0,
      default: 0,
    },
    condition: {
      type: String,
      enum: ['excellent', 'good', 'fair', 'poor'],
      default: 'good',
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    street_address: {
      type: String,
      trim: true,
    },
    postcode: {
      type: String,
      trim: true,
    },
    country: {
      type: String,
      trim: true,
    },
    lat: {
      type: Number,
    },
    lng: {
      type: Number,
    },
    show_on_map: {
      type: Boolean,
      default: true,
    },
    min_rental_days: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    max_rental_days: {
      type: Number,
      required: true,
      min: 1,
      default: 30,
    },
    notice_period_hours: {
      type: Number,
      required: true,
      min: 0,
      default: 24,
    },
    instant_booking: {
      type: Boolean,
      default: false,
    },
    same_day_pickup: {
      type: Boolean,
      default: false,
    },
    delivery_options: [{
      type: String,
    }],
    delivery_fee: {
      type: Number,
      min: 0,
      default: 0,
    },
    delivery_radius: {
      type: Number,
      min: 0,
    },
    images: [{
      type: String,
    }],
    videos: [{
      type: String,
    }],
    availability: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'pending', 'sold'],
      default: 'active',
    },
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  }
)

// Create indexes for better query performance
ItemSchema.index({ owner_id: 1 })
ItemSchema.index({ category: 1 })
ItemSchema.index({ location: 1 })
ItemSchema.index({ availability: 1 })
ItemSchema.index({ status: 1 })
ItemSchema.index({ lat: 1, lng: 1 }) // Geospatial index for location-based queries

/**
 * Item model
 * Mongoose automatically pluralizes 'Item' to 'items' collection
 * This will save to: rentany_platform.items collection
 */
const Item: Model<IItem> = mongoose.models.Item || mongoose.model<IItem>('Item', ItemSchema, 'items')

export default Item
