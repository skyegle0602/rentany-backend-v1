import { IUser } from '../models/users';
import { Document } from 'mongoose';
/**
 * Sync user data from Clerk to MongoDB
 * This function fetches user data from Clerk and creates/updates the user in MongoDB
 */
export declare function syncUserFromClerk(clerkUserId: string): Promise<(Document & IUser) | null>;
/**
 * Get user from MongoDB by Clerk ID
 * If user doesn't exist, sync from Clerk first
 */
export declare function getOrSyncUser(clerkUserId: string): Promise<(Document & IUser) | null>;
/**
 * Get user from MongoDB by email
 */
export declare function getUserByEmail(email: string): Promise<(Document & IUser) | null>;
/**
 * Update user data in MongoDB
 * This is used for updating app-specific fields (not synced from Clerk)
 */
export declare function updateUser(clerkUserId: string, updateData: Partial<IUser>): Promise<(Document & IUser) | null>;
/**
 * Convert MongoDB user document to API response format
 */
export declare function formatUserForAPI(user: IUser): {
    id: string;
    clerk_id: string;
    email: string;
    username: string | undefined;
    full_name: string | undefined;
    profile_picture: string | undefined;
    verification_status: "unverified" | "verified" | "failed" | "pending" | undefined;
    bio: string | undefined;
    preferred_language: string | undefined;
    role: "user" | "admin" | undefined;
    stripe_account_id: string | undefined;
    payouts_enabled: boolean | undefined;
    notification_preferences: {
        email_notifications?: boolean;
        push_notifications?: boolean;
        rental_requests?: boolean;
        messages?: boolean;
        payment_updates?: boolean;
        reviews?: boolean;
        promotions?: boolean;
        transaction_completed?: boolean;
        payout_initiated?: boolean;
    } | undefined;
    push_subscription: {
        enabled: boolean;
        subscribedAt?: string;
        userAgent?: string;
    } | undefined;
    documents: {
        id: string;
        name: string;
        url: string;
        type: string;
        uploadedAt: string;
    }[] | undefined;
    created_at: string;
    updated_at: string;
};
//# sourceMappingURL=userSync.d.ts.map