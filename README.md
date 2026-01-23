# Backend API Server

Express.js backend with Clerk authentication and MongoDB Atlas integration.

## Setup

### 1. Environment Variables

Create a `.env` file in the `backend` directory with the following variables:

```env
# Server
PORT=5000
FRONTEND_URL=http://localhost:3000

# Clerk Authentication
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_WEBHOOK_SECRET=whsec_...  # For Clerk webhooks (optional)

# MongoDB Atlas
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority

# Stripe (optional)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### 2. MongoDB Atlas Setup

1. Create a MongoDB Atlas account at https://www.mongodb.com/cloud/atlas
2. Create a new cluster (free tier available)
3. Create a database user
4. Whitelist your IP address (or use `0.0.0.0/0` for development)
5. Get your connection string from "Connect" → "Connect your application"
6. Replace `<password>` and `<database>` in the connection string
7. Add the connection string to `.env` as `MONGODB_URI`

### 3. Clerk Webhook Setup (Optional but Recommended)

To automatically sync users from Clerk to MongoDB:

1. Go to Clerk Dashboard → Webhooks
2. Click "Add Endpoint"
3. Enter your webhook URL: `https://your-domain.com/api/webhooks/clerk`
4. Select events:
   - `user.created`
   - `user.updated`
   - `user.deleted`
5. Copy the "Signing Secret" and add it to `.env` as `CLERK_WEBHOOK_SECRET`

### 4. Install Dependencies

```bash
npm install
```

### 5. Run the Server

Development mode (with auto-reload):
```bash
npm run dev
```

Production mode:
```bash
npm run build
npm start
```

## API Endpoints

### User Endpoints

- `GET /api/users/me` - Get current user (auto-syncs from Clerk if not in MongoDB)
- `PUT /api/users/me` - Update current user profile
- `GET /api/users/by-email?email=...` - Get user by email
- `POST /api/users/sync` - Manually sync user from Clerk to MongoDB

### Webhook Endpoints

- `POST /api/webhooks/clerk` - Clerk webhook for automatic user syncing

## How User Syncing Works

1. **Automatic Sync on First Access**: When a user calls `GET /api/users/me`, the system:
   - Checks if user exists in MongoDB
   - If not, fetches from Clerk and saves to MongoDB
   - Returns the user data

2. **Webhook Sync**: When Clerk sends webhook events:
   - `user.created` - Creates new user in MongoDB
   - `user.updated` - Updates user in MongoDB
   - `user.deleted` - Logs deletion (keeps in MongoDB for now)

3. **Manual Sync**: Users can call `POST /api/users/sync` to force a refresh from Clerk

## User Data Structure

Users are stored in MongoDB with the following structure:

- **Clerk-managed fields** (synced from Clerk):
  - `clerk_id` - Clerk user ID
  - `email` - User email
  - `username` - Username
  - `full_name` - Full name
  - `profile_picture` - Profile picture URL
  - `verification_status` - Email verification status

- **App-managed fields** (stored in MongoDB only):
  - `bio` - User bio
  - `preferred_language` - Language preference
  - `role` - User role (user/admin)
  - `stripe_account_id` - Stripe Connect account ID
  - `payouts_enabled` - Whether payouts are enabled
  - `notification_preferences` - Notification settings
  - `push_subscription` - Push notification subscription
  - `documents` - User documents array

## Database Models

### User Model (`src/models/users.ts`)

The User model includes:
- Indexes on `clerk_id`, `email`, and `username` for fast lookups
- Automatic timestamps (`created_at`, `updated_at`)
- Field validation and defaults

## Troubleshooting

### MongoDB Connection Issues

- Verify `MONGODB_URI` is correct in `.env`
- Check that your IP is whitelisted in MongoDB Atlas
- Ensure the database user has proper permissions
- Check MongoDB Atlas logs for connection errors

### Clerk Webhook Issues

- Verify `CLERK_WEBHOOK_SECRET` matches the secret in Clerk Dashboard
- Check that webhook URL is accessible (use ngrok for local testing)
- Review server logs for webhook processing errors

### User Sync Issues

- Check that `CLERK_SECRET_KEY` is set correctly
- Verify user exists in Clerk
- Check MongoDB connection status
- Review server logs for sync errors
