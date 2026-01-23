import { Document, Model } from 'mongoose';
/**
 * User interface matching the data structure from Clerk
 */
export interface IUser extends Document {
    clerk_id: string;
    email: string;
    username?: string;
    full_name?: string;
    profile_picture?: string;
    verification_status?: 'verified' | 'pending' | 'failed' | 'unverified';
    bio?: string;
    preferred_language?: string;
    role?: 'user' | 'admin';
    stripe_account_id?: string;
    payouts_enabled?: boolean;
    notification_preferences?: {
        email_notifications?: boolean;
        push_notifications?: boolean;
        rental_requests?: boolean;
        messages?: boolean;
        payment_updates?: boolean;
        reviews?: boolean;
        promotions?: boolean;
        transaction_completed?: boolean;
        payout_initiated?: boolean;
    };
    push_subscription?: {
        enabled: boolean;
        subscribedAt?: string;
        userAgent?: string;
    };
    documents?: Array<{
        id: string;
        name: string;
        url: string;
        type: string;
        uploadedAt: string;
    }>;
    created_at: Date;
    updated_at: Date;
    last_synced_from_clerk?: Date;
}
/**
 * User model
 * Mongoose automatically pluralizes 'User' to 'users' collection
 * This will save to: rentany_platform.users collection
 */
declare const User: Model<IUser>;
export default User;
//# sourceMappingURL=users.d.ts.map