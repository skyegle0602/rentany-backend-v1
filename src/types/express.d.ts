/**
 * Type definitions for Express with Clerk authentication
 */

import { Request } from 'express'

declare global {
  namespace Express {
    interface Request {
      // Clerk auth can be either a function (new API) or an object (old API)
      auth?: (() => {
        userId?: string | null
        sessionId?: string | null
        orgId?: string | null
        orgRole?: string | null
        orgSlug?: string | null
      }) | {
        userId?: string | null
        sessionId?: string | null
        orgId?: string | null
        orgRole?: string | null
        orgSlug?: string | null
      }
    }
  }
}

export {}
