import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestPayload {
  type: string
  table: string
  record: any
  schema: string
  old_record: any
}

interface Coordinates {
  latitude: number
  longitude: number
}

// Calculate distance between two coordinates using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in kilometers
}

// Send push notification using Expo Push API
async function sendPushNotification(pushToken: string, title: string, body: string, data: any = {}) {
  const message = {
    to: pushToken,
    sound: 'default',
    title,
    body,
    data,
    priority: 'high',
    badge: 1,
  };

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log('Push notification sent successfully:', result);
    return result;
  } catch (error) {
    console.error('Error sending push notification:', error);
    throw error;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const payload: RequestPayload = await req.json()
    
    // Only process INSERT operations on requests table
    if (payload.type !== 'INSERT' || payload.table !== 'requests') {
      return new Response(
        JSON.stringify({ message: 'Not a request insert operation' }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    const newRequest = payload.record
    console.log('Processing new request:', newRequest.id)

    // Parse request coordinates
    let requestCoords: Coordinates
    try {
      if (typeof newRequest.coordinates === 'string') {
        requestCoords = JSON.parse(newRequest.coordinates)
      } else {
        requestCoords = newRequest.coordinates
      }
    } catch (error) {
      console.error('Error parsing request coordinates:', error)
      return new Response(
        JSON.stringify({ error: 'Invalid coordinates format' }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    if (!requestCoords.latitude || !requestCoords.longitude) {
      console.error('Missing latitude or longitude in coordinates')
      return new Response(
        JSON.stringify({ error: 'Missing coordinates' }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Find nearby service providers
    const { data: providers, error: providersError } = await supabaseClient
      .from('users')
      .select('id, name, location, service_radius, services, push_token')
      .eq('role', 'provider')
      .not('push_token', 'is', null)
      .not('service_radius', 'is', null)

    if (providersError) {
      console.error('Error fetching providers:', providersError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch providers' }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    console.log(`Found ${providers?.length || 0} providers with push tokens`)

    if (!providers || providers.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No providers with push tokens found' }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    const notificationsToSend = []

    // Check each provider's location and service radius
    for (const provider of providers) {
      try {
        // Parse provider location (assuming it's stored as JSON coordinates)
        let providerCoords: Coordinates
        try {
          if (typeof provider.location === 'string') {
            // Try to parse as JSON first
            try {
              providerCoords = JSON.parse(provider.location)
            } catch {
              // Try parsing as "lat,lng" format
              const parts = provider.location.split(',')
              if (parts.length === 2) {
                const lat = parseFloat(parts[0].trim())
                const lng = parseFloat(parts[1].trim())
                if (!isNaN(lat) && !isNaN(lng)) {
                  providerCoords = { latitude: lat, longitude: lng }
                  console.log(`Parsed provider ${provider.id} coordinates from string: ${lat}, ${lng}`)
                } else {
                  // It's a place name - use geocoding fallback
                  console.log(`Provider ${provider.id} has location as place name: ${provider.location}`)
                  // For now, use a default location (you can add Google Geocoding API later)
                  // Using Lahore, Pakistan coordinates as default for demo
                  providerCoords = { latitude: 31.5204, longitude: 74.3587 }
                  console.log(`Using default coordinates for ${provider.location}: ${providerCoords.latitude}, ${providerCoords.longitude}`)
                }
              } else {
                // It's a place name - use geocoding fallback
                console.log(`Provider ${provider.id} has location as place name: ${provider.location}`)
                // For now, use a default location based on common locations
                if (provider.location.toLowerCase().includes('lahore')) {
                  providerCoords = { latitude: 31.5204, longitude: 74.3587 }
                } else if (provider.location.toLowerCase().includes('nashville')) {
                  providerCoords = { latitude: 36.1627, longitude: -86.7816 }
                } else {
                  // Default fallback
                  providerCoords = { latitude: 31.5204, longitude: 74.3587 }
                }
                console.log(`Using approximate coordinates for ${provider.location}: ${providerCoords.latitude}, ${providerCoords.longitude}`)
              }
            }
          } else {
            providerCoords = provider.location
          }
        } catch (error) {
          console.log(`Skipping provider ${provider.id}: invalid location format`)
          continue
        }

        if (!providerCoords.latitude || !providerCoords.longitude) {
          console.log(`Skipping provider ${provider.id}: missing coordinates`)
          continue
        }

        // Calculate distance between request and provider
        const distance = calculateDistance(
          requestCoords.latitude,
          requestCoords.longitude,
          providerCoords.latitude,
          providerCoords.longitude
        )

        const serviceRadius = provider.service_radius || 50 // Default 50km if not set

        console.log(`Provider ${provider.id}: Distance ${distance.toFixed(2)}km, Service radius: ${serviceRadius}km`)

        // Check if provider is within service radius
        if (distance <= serviceRadius) {
          // Check if provider offers the requested service type
          const providerServices = provider.services || []
          const requestServiceType = newRequest.service_type

          if (providerServices.length === 0 || providerServices.includes(requestServiceType)) {
            console.log(`Adding notification for provider ${provider.id}`)
            
            notificationsToSend.push({
              pushToken: provider.push_token,
              providerId: provider.id,
              providerName: provider.name,
              distance: distance.toFixed(1)
            })
          } else {
            console.log(`Provider ${provider.id} doesn't offer service type: ${requestServiceType}`)
          }
        } else {
          console.log(`Provider ${provider.id} is outside service radius`)
        }
      } catch (error) {
        console.error(`Error processing provider ${provider.id}:`, error)
        continue
      }
    }

    console.log(`Sending notifications to ${notificationsToSend.length} providers`)

    // Send push notifications to nearby providers
    const notificationPromises = notificationsToSend.map(async ({ pushToken, providerId, providerName, distance }) => {
      try {
        const urgencyText = newRequest.urgency === 'high' ? '🚨 URGENT' : 
                           newRequest.urgency === 'medium' ? '⚡ Priority' : '📋 New'
        
        const title = `${urgencyText} Service Request`
        const serviceTypeFormatted = newRequest.service_type
          .replace('_', ' ')
          .split(' ')
          .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ')
        const body = `${serviceTypeFormatted} needed ${distance}km away. Tap to view details.`
        
        await sendPushNotification(pushToken, title, body, {
          type: 'new_request',
          requestId: newRequest.id,
          serviceType: newRequest.service_type,
          urgency: newRequest.urgency,
          distance: distance,
          location: newRequest.location
        })

        return { providerId, status: 'sent' }
      } catch (error) {
        console.error(`Failed to send notification to provider ${providerId}:`, error)
        return { providerId, status: 'failed', error: error.message }
      }
    })

    const results = await Promise.allSettled(notificationPromises)
    const sentCount = results.filter(result => 
      result.status === 'fulfilled' && result.value.status === 'sent'
    ).length

    console.log(`Successfully sent ${sentCount} out of ${notificationsToSend.length} notifications`)

    return new Response(
      JSON.stringify({ 
        message: `Processed request ${newRequest.id}`,
        providersNotified: sentCount,
        totalProviders: notificationsToSend.length,
        results: results.map(result => 
          result.status === 'fulfilled' ? result.value : { status: 'failed' }
        )
      }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('Error in push notification function:', error)
    return new Response(
      JSON.stringify({ error: error.message }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})