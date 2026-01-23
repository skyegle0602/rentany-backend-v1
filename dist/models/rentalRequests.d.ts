import mongoose, { Document } from 'mongoose';
export interface IRentalRequest extends Document {
    item_id: string;
    renter_email: string;
    owner_email: string;
    status: 'pending' | 'approved' | 'declined' | 'completed' | 'cancelled' | 'paid' | 'inquiry';
    start_date: Date;
    end_date: Date;
    total_amount: number;
    message?: string;
    created_at?: Date;
    updated_at?: Date;
}
declare const RentalRequest: mongoose.Model<IRentalRequest, {}, {}, {}, mongoose.Document<unknown, {}, IRentalRequest, {}, mongoose.DefaultSchemaOptions> & IRentalRequest & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IRentalRequest>;
export default RentalRequest;
//# sourceMappingURL=rentalRequests.d.ts.map