import mongoose, { Schema, Document } from 'mongoose'

export interface IFavorite extends Document {
  user_email: string
  item_id: string
  created_at?: Date
  updated_at?: Date
}

const FavoriteSchema = new Schema<IFavorite>(
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
  },
  {
    timestamps: true,
    collection: 'favorites',
  }
)

// Compound index to ensure one favorite per user-item pair
FavoriteSchema.index({ user_email: 1, item_id: 1 }, { unique: true })

const Favorite = mongoose.model<IFavorite>('Favorite', FavoriteSchema)

export default Favorite
