import { Document, Model } from 'mongoose';
/**
 * Review interface
 */
export interface IReview extends Document {
    item_id: string;
    reviewer_email: string;
    reviewee_id?: string;
    rating: number;
    comment: string;
    review_type: 'for_owner' | 'for_renter';
    images?: string[];
    created_date: Date;
    updated_at: Date;
}
/**
 * Review model
 */
declare const Review: Model<IReview>;
export default Review;
//# sourceMappingURL=reviews.d.ts.map