"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.STRIPE_WEBHOOK_SECRET = exports.STRIPE_PUBLISHABLE_KEY = exports.STRIPE_SECRET_KEY = exports.MONGODB_URI = exports.CLERK_WEBHOOK_SECRET = exports.CLERK_PUBLISHABLE_KEY = exports.CLERK_SECRET_KEY = exports.FRONTEND_URL = exports.PORT = void 0;
// Load environment variables from .env file
// This must be at the very top, before any other imports
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
/**
 * Centralized environment variables configuration
 * All environment variables should be loaded and exported from here
 * Other files should import from this file instead of accessing process.env directly
 */
// Server configuration
exports.PORT = process.env.PORT || 5000;
exports.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
// Clerk Authentication
exports.CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY || '';
exports.CLERK_PUBLISHABLE_KEY = process.env.CLERK_PUBLISHABLE_KEY || '';
exports.CLERK_WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET || '';
// MongoDB
exports.MONGODB_URI = process.env.MONGODB_URI || '';
// Stripe
exports.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
exports.STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY || '';
exports.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
// Validation and warnings
if (!exports.CLERK_SECRET_KEY) {
    console.warn('⚠️  CLERK_SECRET_KEY is not set in environment variables');
    console.warn('   Add it to your .env file: CLERK_SECRET_KEY=sk_test_...');
}
if (!exports.CLERK_PUBLISHABLE_KEY) {
    console.warn('⚠️  CLERK_PUBLISHABLE_KEY is not set in environment variables');
    console.warn('   Add it to your .env file: CLERK_PUBLISHABLE_KEY=pk_test_...');
}
if (!exports.MONGODB_URI) {
    console.warn('⚠️  MONGODB_URI is not set in environment variables');
    console.warn('   Add it to your .env file: MONGODB_URI=mongodb+srv://...');
}
if (!exports.STRIPE_SECRET_KEY) {
    console.warn('⚠️  STRIPE_SECRET_KEY is not set in environment variables');
    console.warn('   Add it to your .env file: STRIPE_SECRET_KEY=sk_test_...');
}
if (!exports.STRIPE_PUBLISHABLE_KEY) {
    console.warn('⚠️  STRIPE_PUBLISHABLE_KEY is not set in environment variables');
    console.warn('   Add it to your .env file: STRIPE_PUBLISHABLE_KEY=pk_test_...');
}
//# sourceMappingURL=env.js.map