# Backend Testing Guide

This guide will help you verify that your Express backend with Clerk authentication is working correctly.

## 1. Start the Server

```bash
cd backend
npm run dev
```

You should see:
```
🚀 Server is running on port 5000
📡 API endpoint: http://localhost:5000/api
🔐 Clerk Secret Key: Set ✅
🔑 Clerk Publishable Key: Set ✅
```

If you see "Missing ❌" for any key, check your `.env` file.

## 2. Test the Health Endpoint (Public)

Open your browser or use curl:

**Browser:**
```
http://localhost:5000/api/health
```

**curl:**
```bash
curl http://localhost:5000/api/health
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Server is running",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## 3. Test Protected Endpoint (Requires Authentication)

### Option A: Using Browser (with Clerk Session)

1. Make sure you're logged in to your frontend (http://localhost:3000)
2. Open browser DevTools (F12) → Console
3. Run this JavaScript:

```javascript
fetch('http://localhost:5000/api/users/me', {
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json'
  }
})
.then(res => res.json())
.then(data => console.log('Response:', data))
.catch(err => console.error('Error:', err))
```

**Expected Response (if authenticated):**
```json
{
  "success": true,
  "data": {
    "id": "user_...",
    "email": "user@example.com",
    "username": "username",
    "full_name": "John Doe",
    "profile_picture": "https://...",
    "verification_status": "verified"
  }
}
```

**Expected Response (if NOT authenticated):**
```json
{
  "success": false,
  "error": "Authentication required"
}
```

### Option B: Using curl (without authentication)

```bash
curl http://localhost:5000/api/users/me
```

**Expected Response:**
```json
{
  "success": false,
  "error": "Authentication required"
}
```

## 4. Test from Frontend

In your frontend code, test the API client:

```typescript
// In browser console (while logged in)
import { api } from '@/lib/api-client'

const response = await api.getCurrentUser()
console.log(response)
```

## 5. Common Issues & Solutions

### Issue: "Cannot find module 'dotenv'"
**Solution:**
```bash
cd backend
npm install dotenv
```

### Issue: "Clerk Secret Key: Missing!"
**Solution:**
- Check your `.env` file exists in `backend/` directory
- Verify `CLERK_SECRET_KEY=sk_test_...` is in the file
- Restart the server

### Issue: "Clerk Publishable Key: Missing!"
**Solution:**
- Add `CLERK_PUBLISHABLE_KEY=pk_test_...` to your `.env` file
- Get it from: https://dashboard.clerk.com/last-active?path=api-keys
- Restart the server

### Issue: "CORS error" when calling from frontend
**Solution:**
- Check `FRONTEND_URL` in `.env` matches your frontend URL
- Default should be `http://localhost:3000`
- Make sure `credentials: 'include'` is used in fetch requests

### Issue: "401 Unauthorized" even when logged in
**Solution:**
- Verify Clerk session token is being sent (check cookies in DevTools)
- Make sure frontend and backend use the same Clerk application
- Check that `CLERK_PUBLISHABLE_KEY` matches between frontend and backend

## 6. Verify Environment Variables

Create a test endpoint to check env vars (remove after testing):

```typescript
// Add to server.ts temporarily
app.get('/api/test-env', (req, res) => {
  res.json({
    hasSecretKey: !!process.env.CLERK_SECRET_KEY,
    hasPublishableKey: !!process.env.CLERK_PUBLISHABLE_KEY,
    port: process.env.PORT,
    frontendUrl: process.env.FRONTEND_URL,
    // Don't expose actual keys!
  })
})
```

## 7. Check Server Logs

Watch the console for:
- ✅ Server startup messages
- ✅ Request logs (if you add logging middleware)
- ❌ Error messages

## 8. Test Checklist

- [ ] Server starts without errors
- [ ] Health endpoint returns success
- [ ] Protected endpoint returns 401 when not authenticated
- [ ] Protected endpoint returns user data when authenticated
- [ ] CORS allows requests from frontend
- [ ] Environment variables are loaded correctly

## Next Steps

Once basic testing passes:
1. Test all your API routes
2. Test file uploads
3. Test error handling
4. Test with different user roles
5. Test rate limiting (if implemented)
