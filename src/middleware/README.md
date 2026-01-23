# Clerk Authentication Middleware

This middleware integrates Clerk authentication with the Express backend.

## Setup

1. **Environment Variables**
   - Add `CLERK_SECRET_KEY` to your `.env` file
   - Get your secret key from: https://dashboard.clerk.com

2. **How It Works**
   - The `clerkAuth` middleware automatically:
     - Reads Clerk session tokens from `__session` cookie or `Authorization` header
     - Verifies the token using `CLERK_SECRET_KEY`
     - Attaches user authentication data to `req.auth` via `getAuth(req)`

## Usage

### Basic Authentication Check

```typescript
import { requireAuth, getCurrentUser } from '../middleware/clerk'

// Protect a route
router.get('/protected', requireAuth, async (req, res) => {
  // User is authenticated
  const user = await getCurrentUser(req)
  res.json({ user })
})
```

### Get Current User

```typescript
import { getCurrentUser } from '../middleware/clerk'

router.get('/api/users/me', requireAuth, async (req, res) => {
  const user = await getCurrentUser(req)
  
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  
  res.json({ success: true, data: user })
})
```

### Public Routes

Routes that don't require authentication can use the `publicRoutes` middleware:

```typescript
import { publicRoutes } from '../middleware/clerk'

// This allows public access but still extracts user if token is present
app.use('/api/public', publicRoutes, publicRouter)
```

## Frontend Integration

The frontend API client (`frontend/lib/api-client.tsx`) uses `credentials: 'include'` which automatically sends Clerk session cookies with requests.

**Important:** Make sure your frontend Clerk configuration matches your backend:
- Same Clerk application
- CORS is configured to allow credentials
- Frontend URL is set in `FRONTEND_URL` environment variable

## Helper Functions

### `getCurrentUser(req: Request)`
- Returns the full user object from Clerk
- Returns `null` if user is not authenticated
- Includes: id, email, username, full_name, profile_picture, verification_status

### `requireAuth(req, res, next)`
- Middleware that returns 401 if user is not authenticated
- Use this to protect routes

### `getAuth(req: Request)`
- Returns `{ userId, sessionId, orgId, orgRole, orgSlug }`
- This is from Clerk Express - use for quick auth checks

## Example Route

See `backend/src/routes/users.ts` for a complete example.
