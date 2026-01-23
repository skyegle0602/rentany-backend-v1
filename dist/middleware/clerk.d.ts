import { Request, Response, NextFunction } from 'express';
export declare const clerkClientInstance: import("@clerk/express").ClerkClient;
declare global {
    namespace Express {
        interface Request {
            auth?: {
                userId?: string | null;
                sessionId?: string | null;
                orgId?: string | null;
                orgRole?: string | null;
                orgSlug?: string | null;
            };
        }
    }
}
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
export declare const clerkAuth: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
/**
 * Middleware to require authentication
 * Returns 401 if user is not authenticated
 */
export declare const requireAuth: (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
/**
 * Middleware for public routes that don't require authentication
 * Still runs Clerk middleware to extract user if available
 */
export declare const publicRoutes: (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
/**
 * Helper function to get the current authenticated user from Clerk
 * Returns null if user is not authenticated
 */
export declare function getCurrentUser(req: Request): Promise<{
    id: string;
    email: string;
    username: string | undefined;
    full_name: string | undefined;
    profile_picture: string | undefined;
    verification_status: "unverified" | "verified";
    created_at: string | undefined;
    updated_at: string | undefined;
} | null>;
/**
 * Helper function to get user email from request
 */
export declare function getUserEmail(req: Request): string | null;
/**
 * Helper function to get auth data from request
 * Uses req.auth() as a function (new Clerk API) or req.auth (fallback)
 */
export declare function getAuth(req: Request): any;
//# sourceMappingURL=clerk.d.ts.map