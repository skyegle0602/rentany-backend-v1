"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
/**
 * User schema for MongoDB
 */
const UserSchema = new mongoose_1.Schema({
    clerk_id: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        index: true,
        lowercase: true,
        trim: true,
    },
    username: {
        type: String,
        unique: true,
        sparse: true, // Allow multiple null values
        trim: true,
        lowercase: true,
    },
    full_name: {
        type: String,
        trim: true,
    },
    profile_picture: {
        type: String,
    },
    verification_status: {
        type: String,
        enum: ['verified', 'pending', 'failed', 'unverified'],
        default: 'unverified',
    },
    bio: {
        type: String,
        maxlength: 500,
    },
    preferred_language: {
        type: String,
        default: 'en',
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user',
    },
    stripe_account_id: {
        type: String,
    },
    payouts_enabled: {
        type: Boolean,
        default: false,
    },
    notification_preferences: {
        email_notifications: { type: Boolean, default: true },
        push_notifications: { type: Boolean, default: true },
        rental_requests: { type: Boolean, default: true },
        messages: { type: Boolean, default: true },
        payment_updates: { type: Boolean, default: true },
        reviews: { type: Boolean, default: true },
        promotions: { type: Boolean, default: true },
        transaction_completed: { type: Boolean, default: true },
        payout_initiated: { type: Boolean, default: true },
    },
    push_subscription: {
        enabled: { type: Boolean, default: false },
        subscribedAt: { type: String },
        userAgent: { type: String },
    },
    documents: [
        {
            id: String,
            name: String,
            url: String,
            type: String,
            uploadedAt: String,
        },
    ],
    last_synced_from_clerk: {
        type: Date,
    },
}, {
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at',
    },
});
// Create indexes for better query performance
UserSchema.index({ email: 1 });
UserSchema.index({ clerk_id: 1 });
UserSchema.index({ username: 1 });
/**
 * User model
 * Mongoose automatically pluralizes 'User' to 'users' collection
 * This will save to: rentany_platform.users collection
 */
const User = mongoose_1.default.models.User || mongoose_1.default.model('User', UserSchema, 'users');
exports.default = User;
//# sourceMappingURL=users.js.map