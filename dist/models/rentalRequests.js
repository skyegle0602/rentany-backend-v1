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
const RentalRequestSchema = new mongoose_1.Schema({
    item_id: {
        type: String,
        required: true,
        index: true,
    },
    renter_email: {
        type: String,
        required: true,
        index: true,
    },
    owner_email: {
        type: String,
        required: true,
        index: true,
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'declined', 'completed', 'cancelled', 'paid', 'inquiry'],
        default: 'pending',
        index: true,
    },
    start_date: {
        type: Date,
        required: true,
    },
    end_date: {
        type: Date,
        required: true,
    },
    total_amount: {
        type: Number,
        required: true,
        min: 0,
    },
    message: {
        type: String,
        trim: true,
    },
}, {
    timestamps: true,
    collection: 'rental_requests',
});
// Indexes for efficient queries
RentalRequestSchema.index({ renter_email: 1, updated_at: -1 });
RentalRequestSchema.index({ owner_email: 1, updated_at: -1 });
RentalRequestSchema.index({ item_id: 1 });
const RentalRequest = mongoose_1.default.model('RentalRequest', RentalRequestSchema);
exports.default = RentalRequest;
//# sourceMappingURL=rentalRequests.js.map