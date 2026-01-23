import { Document, Model } from 'mongoose';
/**
 * ViewedItem interface matching the data structure
 */
export interface IViewedItem extends Document {
    user_email: string;
    item_id: string;
    viewed_date: Date;
    view_count: number;
    created_at: Date;
    updated_at: Date;
}
declare const ViewedItem: Model<IViewedItem>;
export default ViewedItem;
//# sourceMappingURL=viewedItems.d.ts.map