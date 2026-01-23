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
 * Item schema for MongoDB
 */
const ItemSchema = new mongoose_1.Schema({
    owner_id: {
        type: String,
        required: true,
        index: true,
    },
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200,
    },
    description: {
        type: String,
        required: true,
        trim: true,
        maxlength: 5000,
    },
    category: {
        type: String,
        required: true,
        trim: true,
    },
    daily_rate: {
        type: Number,
        required: true,
        min: 0,
    },
    pricing_tiers: [{
            days: {
                type: Number,
                required: true,
                min: 1,
            },
            price: {
                type: Number,
                required: true,
                min: 0,
            },
        }],
    deposit: {
        type: Number,
        min: 0,
        default: 0,
    },
    condition: {
        type: String,
        enum: ['excellent', 'good', 'fair', 'poor'],
        default: 'good',
    },
    location: {
        type: String,
        required: true,
        trim: true,
    },
    street_address: {
        type: String,
        trim: true,
    },
    postcode: {
        type: String,
        trim: true,
    },
    country: {
        type: String,
        trim: true,
    },
    lat: {
        type: Number,
    },
    lng: {
        type: Number,
    },
    show_on_map: {
        type: Boolean,
        default: true,
    },
    min_rental_days: {
        type: Number,
        required: true,
        min: 1,
        default: 1,
    },
    max_rental_days: {
        type: Number,
        required: true,
        min: 1,
        default: 30,
    },
    notice_period_hours: {
        type: Number,
        required: true,
        min: 0,
        default: 24,
    },
    instant_booking: {
        type: Boolean,
        default: false,
    },
    same_day_pickup: {
        type: Boolean,
        default: false,
    },
    delivery_options: [{
            type: String,
        }],
    delivery_fee: {
        type: Number,
        min: 0,
        default: 0,
    },
    delivery_radius: {
        type: Number,
        min: 0,
    },
    images: [{
            type: String,
        }],
    videos: [{
            type: String,
        }],
    availability: {
        type: Boolean,
        default: true,
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'pending', 'sold'],
        default: 'active',
    },
}, {
    timestamps: {
        createdAt: 'created_at',
        updatedAt: 'updated_at',
    },
});
// Create indexes for better query performance
ItemSchema.index({ owner_id: 1 });
ItemSchema.index({ category: 1 });
ItemSchema.index({ location: 1 });
ItemSchema.index({ availability: 1 });
ItemSchema.index({ status: 1 });
ItemSchema.index({ lat: 1, lng: 1 }); // Geospatial index for location-based queries
/**
 * Item model
 * Mongoose automatically pluralizes 'Item' to 'items' collection
 * This will save to: rentany_platform.items collection
 */
const Item = mongoose_1.default.models.Item || mongoose_1.default.model('Item', ItemSchema, 'items');
exports.default = Item;
//# sourceMappingURL=items.js.map