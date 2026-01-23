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
 * Review schema for MongoDB
 */
const ReviewSchema = new mongoose_1.Schema({
    item_id: {
        type: String,
        required: true,
        index: true,
    },
    reviewer_email: {
        type: String,
        required: true,
        index: true,
        lowercase: true,
        trim: true,
    },
    reviewee_id: {
        type: String,
        index: true,
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5,
    },
    comment: {
        type: String,
        required: true,
        trim: true,
    },
    review_type: {
        type: String,
        enum: ['for_owner', 'for_renter'],
        required: true,
    },
    images: [{
            type: String,
        }],
}, {
    timestamps: {
        createdAt: 'created_date',
        updatedAt: 'updated_at',
    },
});
// Create indexes for better query performance
ReviewSchema.index({ item_id: 1 });
ReviewSchema.index({ reviewer_email: 1 });
ReviewSchema.index({ reviewee_id: 1 });
ReviewSchema.index({ review_type: 1 });
/**
 * Review model
 */
const Review = mongoose_1.default.models.Review || mongoose_1.default.model('Review', ReviewSchema, 'reviews');
exports.default = Review;
//# sourceMappingURL=reviews.js.map