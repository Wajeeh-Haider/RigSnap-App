# Backend Setup Instructions

## Current Issue
The app is trying to connect to a Stripe backend server at `http://localhost:3000` which is not accessible from mobile devices.

## Temporary Fix Applied
- Added `BYPASS_PAYMENTS_FOR_TESTING = true` flag in `utils/stripe.ts`
- This allows the app to work without payment processing for testing
- User names should now be fetched properly from Supabase

## Production Solution Needed
To use this app in production, you need to:

### 1. Set up a backend server with Stripe integration
Create a Node.js/Express server with these endpoints:
- `POST /api/stripe/create-payment-intent`
- `POST /api/stripe/setup-payment-method` 
- `POST /api/stripe/charge-payment-method`
- `POST /api/stripe/detach-payment-method`

### 2. Deploy the backend server
Deploy to services like:
- Heroku
- Vercel
- Railway
- AWS/Google Cloud

### 3. Update the environment variable
In `.env` file, change:
```
EXPO_PUBLIC_BACKEND_URL=https://your-deployed-backend-url.com
```

### 4. Disable testing bypass
In `utils/stripe.ts`, change:
```typescript
const BYPASS_PAYMENTS_FOR_TESTING = false;
```

## Current Status
✅ User names should now display correctly
✅ Request creation works (bypassing payment)
✅ Request acceptance works (bypassing payment)
❌ Actual payment processing disabled
❌ No $5 charges are processed

## Testing on Physical Device
If testing on a physical device and need to connect to a local backend:
1. Find your computer's IP address (e.g., `192.168.1.100`)
2. Update BACKEND_URL to use your IP: `http://192.168.1.100:3000`
3. Make sure your backend server binds to `0.0.0.0:3000` not just `localhost:3000`