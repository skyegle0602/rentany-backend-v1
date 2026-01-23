"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publicRoutes = exports.requireAuth = exports.clerkAuth = exports.clerkClientInstance = void 0;
exports.getCurrentUser = getCurrentUser;
exports.getUserEmail = getUserEmail;
exports.getAuth = getAuth;
const express_1 = require("@clerk/express");
const env_1 = require("../config/env");
// Verify environment variables are set
if (!env_1.CLERK_SECRET_KEY) {
    console.error('❌ CLERK_SECRET_KEY is missing from environment variables');
    console.error('   Add it to your .env file: CLERK_SECRET_KEY=sk_test_...');
}
if (!env_1.CLERK_PUBLISHABLE_KEY) {
    console.error('❌ CLERK_PUBLISHABLE_KEY is missing from environment variables');
    console.error('   Add it to your .env file: CLERK_PUBLISHABLE_KEY=pk_test_...');
    console.error('   Get your keys from: https://dashboard.clerk.com/last-active?path=api-keys');
}
// Create Clerk client instance
exports.clerkClientInstance = (0, express_1.createClerkClient)({
    secretKey: env_1.CLERK_SECRET_KEY
});
/**
 * Clerk middleware that verifies authentication and adds user data to request
 * This middleware extracts the Clerk session token from cookies or Authorization header
 *
 * Note: Clerk Express middleware automatically:
 * - Reads session token from __session cookie or Authorization header
 * - Verifies the token using CLERK_SECRET_KEY and CLERK_PUBLISHABLE_KEY
 * - Attaches auth data to req.auth via getAuth(req)
 *
 * Required environment variables:
 * - CLERK_SECRET_KEY: Your Clerk secret key (starts with sk_test_ or sk_live_)
 * - CLERK_PUBLISHABLE_KEY: Your Clerk publishable key (starts with pk_test_ or pk_live_)
 */
// Clerk middleware automatically reads from environment variables:
// - CLERK_SECRET_KEY
// - CLERK_PUBLISHABLE_KEY
// Make sure both are set in your .env file
// 
// Configure middleware to read from cookies (__session cookie) and Authorization header
exports.clerkAuth = (0, express_1.clerkMiddleware)({
// Clerk middleware automatically reads from __session cookie
// No additional configuration needed - it reads from cookies by default
// The middleware will extract the session token from:
// 1. __session cookie (default Clerk cookie name)
// 2. Authorization header (Bearer token)
});
/**
 * Middleware to require authentication
 * Returns 401 if user is not authenticated
 */
const requireAuth = (req, res, next) => {
    // Use req.auth() as a function (new Clerk API) - access once to avoid deprecation warnings
    let auth;
    const authValue = req.auth;
    try {
        // Always try as function first (new API - preferred)
        if (typeof authValue === 'function') {
            auth = authValue();
        }
        else if (authValue !== undefined) {
            // Only access as property if function doesn't exist (deprecated but needed for compatibility)
            auth = authValue;
        }
    }
    catch (error) {
        // If function call fails, use property value if available
        if (authValue !== undefined && typeof authValue !== 'function') {
            auth = authValue;
        }
        else {
            auth = undefined;
        }
    }
    const userId = auth?.userId;
    if (!userId) {
        // Log debug info for 401 errors
        console.log('🔒 401 Unauthorized - Authentication required');
        console.log('   Path:', req.path);
        console.log('   Method:', req.method);
        console.log('   Auth object:', JSON.stringify(auth, null, 2));
        console.log('   Cookies:', req.headers.cookie ? 'Present' : 'Missing');
        if (req.headers.cookie) {
            // Log cookie names (but not values for security)
            const cookieNames = req.headers.cookie.split(';').map(c => c.split('=')[0].trim());
            console.log('   Cookie names:', cookieNames.join(', '));
            // Check for __session cookie specifically
            const hasSessionCookie = req.headers.cookie.includes('__session');
            console.log('   __session cookie:', hasSessionCookie ? 'Present' : 'Missing');
        }
        console.log('   Authorization header:', req.headers.authorization ? 'Present' : 'Missing');
        return res.status(401).json({
            success: false,
            error: 'Authentication required. Please sign in to access this resource.',
        });
    }
    next();
};
exports.requireAuth = requireAuth;
/**
 * Middleware for public routes that don't require authentication
 * Still runs Clerk middleware to extract user if available
 */
const publicRoutes = (req, res, next) => {
    // Allow public routes without authentication
    // Clerk middleware will still extract user if token is present
    // Get the full path - use originalUrl which contains the full path from the root
    // req.path is relative to where the middleware is mounted
    const originalUrl = req.originalUrl || req.url || '';
    const fullPath = originalUrl.split('?')[0]; // Remove query string
    const relativePath = req.path || '';
    const publicPaths = [
        '/api/public',
        '/api/stripe',
        '/api/health',
        '/api/auth',
        '/api/webhooks', // All webhook routes are public
        '/api/items', // GET /api/items is public (viewing items doesn't require auth)
        '/api/reviews', // GET /api/reviews is public (viewing reviews doesn't require auth)
        '/api/item-availability', // GET /api/item-availability is public (viewing availability doesn't require auth)
        '/api/favorites', // GET /api/favorites is public (viewing favorites doesn't require auth)
        '/api/viewed-items', // GET /api/viewed-items is public (viewing history doesn't require auth)
    ];
    // Check if path matches any public path (check both full path and relative path)
    const isPublicPath = publicPaths.some(publicPath => fullPath.startsWith(publicPath) || relativePath.startsWith(publicPath.replace('/api/', '/')));
    // For GET requests to items, reviews, item-availability, favorites, and viewed-items, allow without auth (viewing is public)
    // Check both the full path (/api/items) and the relative path (/items when inside router)
    const isPublicGetRequest = req.method === 'GET' && (fullPath.startsWith('/api/items') ||
        fullPath.startsWith('/api/reviews') ||
        fullPath.startsWith('/api/item-availability') ||
        fullPath.startsWith('/api/favorites') ||
        fullPath.startsWith('/api/viewed-items') ||
        relativePath.startsWith('/items') ||
        relativePath.startsWith('/reviews') ||
        relativePath.startsWith('/item-availability') ||
        relativePath.startsWith('/favorites') ||
        relativePath.startsWith('/viewed-items'));
    // Debug logging for public routes (only in development)
    if (process.env.NODE_ENV === 'development' && (fullPath.includes('/items') || relativePath.includes('/items'))) {
        console.log('🔍 publicRoutes check:', {
            fullPath,
            relativePath,
            method: req.method,
            isPublicPath,
            isPublicGetRequest,
            willAllow: isPublicPath || isPublicGetRequest
        });
    }
    if (isPublicPath || isPublicGetRequest) {
        return next();
    }
    // For protected routes, require authentication
    return (0, exports.requireAuth)(req, res, next);
};
exports.publicRoutes = publicRoutes;
/**
 * Helper function to get the current authenticated user from Clerk
 * Returns null if user is not authenticated
 */
async function getCurrentUser(req) {
    // Use req.auth() as a function (new Clerk API) - access once to avoid deprecation warnings
    let auth;
    const authValue = req.auth;
    try {
        // Always try as function first (new API - preferred)
        if (typeof authValue === 'function') {
            auth = authValue();
        }
        else if (authValue !== undefined) {
            // Only access as property if function doesn't exist (deprecated but needed for compatibility)
            auth = authValue;
        }
    }
    catch (error) {
        // If function call fails, use property value if available
        if (authValue !== undefined && typeof authValue !== 'function') {
            auth = authValue;
        }
        else {
            auth = undefined;
        }
    }
    const userId = auth?.userId;
    if (!userId) {
        return null;
    }
    try {
        // Fetch user data from Clerk
        const user = await exports.clerkClientInstance.users.getUser(userId);
        // Helper to convert timestamp to ISO string
        const toISOString = (timestamp) => {
            if (!timestamp)
                return undefined;
            if (timestamp instanceof Date)
                return timestamp.toISOString();
            if (typeof timestamp === 'number') {
                // If it's a Unix timestamp in seconds, convert to milliseconds
                const date = timestamp < 10000000000
                    ? new Date(timestamp * 1000)
                    : new Date(timestamp);
                return date.toISOString();
            }
            return undefined;
        };
        return {
            id: user.id,
            email: user.emailAddresses[0]?.emailAddress || '',
            username: user.username || user.firstName || undefined,
            full_name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || undefined,
            profile_picture: user.imageUrl || undefined,
            verification_status: user.emailAddresses[0]?.verification?.status === 'verified'
                ? 'verified'
                : 'unverified',
            created_at: toISOString(user.createdAt),
            updated_at: toISOString(user.updatedAt),
        };
    }
    catch (error) {
        console.error('Error fetching user from Clerk:', error);
        return null;
    }
}
/**
 * Helper function to get user email from request
 */
function getUserEmail(req) {
    // Use req.auth() as a function (new Clerk API) - access once to avoid deprecation warnings
    let auth;
    const authValue = req.auth;
    try {
        // Always try as function first (new API - preferred)
        if (typeof authValue === 'function') {
            auth = authValue();
        }
        else if (authValue !== undefined) {
            // Only access as property if function doesn't exist (deprecated but needed for compatibility)
            auth = authValue;
        }
    }
    catch (error) {
        // If function call fails, use property value if available
        if (authValue !== undefined && typeof authValue !== 'function') {
            auth = authValue;
        }
        else {
            auth = undefined;
        }
    }
    const userId = auth?.userId;
    if (!userId) {
        return null;
    }
    // This is a synchronous helper - for full user data, use getCurrentUser
    // For now, we'll need to fetch from Clerk in routes that need email
    return null;
}
/**
 * Helper function to get auth data from request
 * Uses req.auth() as a function (new Clerk API) or req.auth (fallback)
 */
function getAuth(req) {
    // Access once to avoid deprecation warnings
    const authValue = req.auth;
    try {
        // Always try as function first (new API - preferred)
        if (typeof authValue === 'function') {
            return authValue();
        }
        // Only access as property if function doesn't exist (deprecated but needed for compatibility)
        if (authValue !== undefined) {
            return authValue;
        }
        return {};
    }
    catch (error) {
        // If function call fails, use property value if available
        if (authValue !== undefined && typeof authValue !== 'function') {
            return authValue;
        }
        return {};
    }
}
//# sourceMappingURL=clerk.js.map