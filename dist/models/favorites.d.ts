import mongoose, { Document } from 'mongoose';
export interface IFavorite extends Document {
    user_email: string;
    item_id: string;
    created_at?: Date;
    updated_at?: Date;
}
declare const Favorite: mongoose.Model<IFavorite, {}, {}, {}, mongoose.Document<unknown, {}, IFavorite, {}, mongoose.DefaultSchemaOptions> & IFavorite & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IFavorite>;
export default Favorite;
//# sourceMappingURL=favorites.d.ts.map