import { Document, Model } from 'mongoose';
/**
 * Item interface matching the data structure
 */
export interface IItem extends Document {
    owner_id: string;
    title: string;
    description: string;
    category: string;
    daily_rate: number;
    pricing_tiers?: Array<{
        days: number;
        price: number;
    }>;
    deposit?: number;
    condition: 'excellent' | 'good' | 'fair' | 'poor';
    location: string;
    street_address?: string;
    postcode?: string;
    country?: string;
    lat?: number;
    lng?: number;
    show_on_map: boolean;
    min_rental_days: number;
    max_rental_days: number;
    notice_period_hours: number;
    instant_booking: boolean;
    same_day_pickup: boolean;
    delivery_options: string[];
    delivery_fee?: number;
    delivery_radius?: number;
    images: string[];
    videos?: string[];
    availability: boolean;
    status?: 'active' | 'inactive' | 'pending' | 'sold';
    created_at: Date;
    updated_at: Date;
}
/**
 * Item model
 * Mongoose automatically pluralizes 'Item' to 'items' collection
 * This will save to: rentany_platform.items collection
 */
declare const Item: Model<IItem>;
export default Item;
//# sourceMappingURL=items.d.ts.map