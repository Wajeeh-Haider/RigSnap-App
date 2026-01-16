# Real-time Push Notifications Setup

This document explains the real-time push notification system implemented for the RigSnap app.

## Overview

When a trucker creates a new service request, the system automatically:
1. **Finds nearby service providers** based on their location and service radius
2. **Filters by service type** to only notify providers who offer the requested service
3. **Sends push notifications** to relevant providers in real-time
4. **Handles location-based filtering** using geographic distance calculations

## Architecture

### Components

1. **Client-side (React Native)**
   - `utils/pushNotifications.ts` - Handles notification permissions and token management
   - Push notification integration in `AuthContext.tsx`
   - Automatic token registration on user login

2. **Database Schema**
   - Added `push_token` field to `users` table
   - Distance calculation function for geographic filtering
   - Indexes for performance optimization

3. **Supabase Edge Function**
   - `supabase/functions/send-push-notifications/index.ts`
   - Processes new requests and finds nearby providers
   - Sends notifications via Expo Push API

4. **Request Creation Flow**
   - `utils/paymentOperations.ts` - Modified to trigger push notifications
   - Automatic notification sending after successful request creation

## Setup Instructions

### 1. Database Migration
Run the migration files to add the necessary database structure:
```bash
# Apply the migrations
supabase db push
```

### 2. Deploy Edge Function
Deploy the push notification edge function to Supabase:
```bash
# Deploy the edge function
supabase functions deploy send-push-notifications
```

### 3. Configure Environment Variables
In your Supabase project, ensure these environment variables are set for the edge function:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for database access

### 4. Test Push Notifications

#### Test Setup
1. **Register a service provider** with:
   - Location coordinates (stored as JSON in location field)
   - Service radius (e.g., 50 km)
   - Services array (e.g., ['towing', 'repair'])
   - Valid push token (will be set automatically when they log in)

2. **Create a request** as a trucker:
   - Ensure coordinates are within the provider's service radius
   - Request a service type that the provider offers

3. **Verify notification delivery**:
   - Provider should receive a push notification
   - Check Supabase logs for edge function execution
   - Monitor app console for push token registration

## How It Works

### Distance Calculation
The system uses the Haversine formula to calculate distances between coordinates:
```typescript
function calculateDistance(lat1, lon1, lat2, lon2) {
  // Returns distance in kilometers
}
```

### Provider Filtering
A service provider receives notifications when:
1. **Geographic proximity**: Request location is within their `service_radius`
2. **Service match**: They offer the requested service type (or have no specific services)
3. **Valid push token**: They have a registered push notification token
4. **Active status**: They are a 'provider' role user

### Notification Content
Notifications include:
- **Title**: Urgency level + "Service Request"
- **Body**: Service type + distance + location
- **Data**: Request ID, service type, urgency, coordinates for navigation

## Troubleshooting

### Common Issues

1. **No notifications received**:
   - Check if provider has valid push token in database
   - Verify location coordinates are properly formatted
   - Ensure provider's service radius covers the request location

2. **Edge function errors**:
   - Check Supabase function logs
   - Verify environment variables are set
   - Ensure database permissions are correct

3. **Push token registration fails**:
   - Check if device permissions are granted
   - Verify Expo project ID is correct in app.json
   - Test on physical device (required for push notifications)

### Debug Queries

Check provider setup:
```sql
SELECT id, name, location, service_radius, services, push_token 
FROM users 
WHERE role = 'provider' 
AND push_token IS NOT NULL;
```

Check recent requests:
```sql
SELECT id, location, coordinates, service_type, urgency, created_at
FROM requests 
WHERE status = 'pending' 
ORDER BY created_at DESC 
LIMIT 10;
```

## Future Enhancements

1. **Notification preferences** - Let providers choose notification types
2. **Batch notifications** - Reduce API calls for multiple providers
3. **Real-time updates** - Notify when requests are accepted/cancelled
4. **Analytics** - Track notification delivery and response rates
5. **Custom sounds** - Different notification sounds for urgency levels

## Security Notes

- Push tokens are automatically refreshed and updated
- Edge function uses service role key for database access
- Geographic data is used only for distance calculations
- No sensitive information is included in push notification payload