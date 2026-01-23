import mongoose, { Document } from 'mongoose';
export interface IItemAvailability extends Document {
    item_id: string;
    blocked_start_date: Date;
    blocked_end_date: Date;
    reason: string;
    created_at?: Date;
    updated_at?: Date;
}
declare const ItemAvailability: mongoose.Model<IItemAvailability, {}, {}, {}, mongoose.Document<unknown, {}, IItemAvailability, {}, mongoose.DefaultSchemaOptions> & IItemAvailability & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IItemAvailability>;
export default ItemAvailability;
//# sourceMappingURL=itemAvailability.d.ts.map