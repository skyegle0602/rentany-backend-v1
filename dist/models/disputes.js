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
 * Dispute schema for MongoDB
 */
const DisputeSchema = new mongoose_1.Schema({
    rental_request_id: {
        type: String,
        required: true,
        index: true,
    },
    filed_by_email: {
        type: String,
        required: true,
        index: true,
        lowercase: true,
        trim: true,
    },
    against_email: {
        type: String,
        required: true,
        index: true,
        lowercase: true,
        trim: true,
    },
    reason: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        required: true,
        trim: true,
    },
    status: {
        type: String,
        enum: ['open', 'under_review', 'resolved', 'closed'],
        default: 'open',
        index: true,
    },
    evidence_urls: [{
            type: String,
        }],
    resolution: {
        type: String,
        trim: true,
    },
    decision: {
        type: String,
        trim: true,
    },
    refund_to_renter: {
        type: Number,
        min: 0,
    },
    charge_to_owner: {
        type: Number,
        min: 0,
    },
    admin_notes: {
        type: String,
        trim: true,
    },
    resolved_date: {
        type: Date,
    },
}, {
    timestamps: {
        createdAt: 'created_date',
        updatedAt: false, // We don't need updated_at for disputes
    },
});
// Create indexes for better query performance
DisputeSchema.index({ rental_request_id: 1 });
DisputeSchema.index({ filed_by_email: 1 });
DisputeSchema.index({ against_email: 1 });
DisputeSchema.index({ status: 1 });
DisputeSchema.index({ created_date: -1 });
/**
 * Dispute model
 */
const Dispute = mongoose_1.default.models.Dispute || mongoose_1.default.model('Dispute', DisputeSchema, 'disputes');
exports.default = Dispute;
//# sourceMappingURL=disputes.js.map