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

interface EmailPayload {
  to: string
  subject: string
  html: string
  from_name?: string
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

// Send email via backend API
async function sendEmail(payload: EmailPayload) {
  const backendUrl = Deno.env.get("EXPO_PUBLIC_BACKEND_URL")
  if (!backendUrl) throw new Error("Backend URL not configured")

  const res = await fetch(`${backendUrl}/api/send-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(error)
  }
}

// Generate email content for new request
function generateEmail(request: any, customerName: string) {
  return {
    subject: `New Service Request - ${request.service_type}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h2 style="color: #2563eb; margin-bottom: 20px; text-align: center;">New Service Request</h2>
          
          <div style="background-color: #f0f9ff; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #2563eb;">
            <p style="margin: 5px 0; color: #1e40af;"><strong>Customer:</strong> ${customerName}</p>
            <p style="margin: 5px 0; color: #1e40af;"><strong>Service Type:</strong> ${request.service_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
            <p style="margin: 5px 0; color: #1e40af;"><strong>Urgency:</strong> ${request.urgency ? request.urgency.charAt(0).toUpperCase() + request.urgency.slice(1) : 'Normal'}</p>
            <p style="margin: 5px 0; color: #1e40af;"><strong>Location:</strong> ${request.location || "N/A"}</p>
          </div>
          
          <div style="margin-bottom: 20px;">
            <h3 style="color: #374151; margin-bottom: 10px;">Description:</h3>
            <p style="color: #4b5563; line-height: 1.6; background-color: #f3f4f6; padding: 15px; border-radius: 6px;">${request.description || "No description provided"}</p>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <p style="color: #6b7280; font-size: 14px;">Please respond promptly to this service request.</p>
            <p style="color: #6b7280; font-size: 12px; margin-top: 10px;">Sent by RigSnap</p>
          </div>
        </div>
      </div>
    `,
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
    console.log('Full request data:', JSON.stringify(newRequest, null, 2))

    // Parse request coordinates
    let requestCoords: Coordinates
    try {
      console.log('Coordinates type:', typeof newRequest.coordinates)
      console.log('Coordinates value:', newRequest.coordinates)
      
      if (typeof newRequest.coordinates === 'string') {
        requestCoords = JSON.parse(newRequest.coordinates)
      } else {
        requestCoords = newRequest.coordinates
      }
      
      console.log('Parsed coordinates:', requestCoords)
    } catch (error) {
      console.error('Error parsing request coordinates:', error)
      return new Response(
        JSON.stringify({ error: 'Invalid coordinates format', details: error.message }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    if (!requestCoords || !requestCoords.latitude || !requestCoords.longitude) {
      console.error('Missing or invalid coordinates:', requestCoords)
      return new Response(
        JSON.stringify({ error: 'Missing coordinates', coordinates: requestCoords }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Get customer name
    const { data: customer, error: customerError } = await supabaseClient
      .from('users')
      .select('name')
      .eq('id', newRequest.trucker_id)
      .single()

    if (customerError || !customer) {
      console.error('Customer not found:', customerError)
      return new Response(
        JSON.stringify({ error: 'Customer not found' }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const customerName = customer.name

    // Find nearby service providers using PostGIS RPC
    const { data: providers, error: providersError } = await supabaseClient
      .rpc('nearby_locations', {
        lat: requestCoords.latitude,
        long: requestCoords.longitude,
        radius_meters: 50000 // 50km search radius
      })

    if (providersError) {
      console.error('Error fetching nearby providers:', providersError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch nearby providers' }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    console.log(`Found ${providers?.length || 0} nearby providers`)

    if (!providers || providers.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No nearby providers found' }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Filter providers who have push tokens and are within their service radius
    const providersWithTokens = providers.filter(provider => {
      // Check if provider has push token
      if (!provider.push_token) return false

      // Check if distance is within provider's service radius (convert km to meters)
      const serviceRadiusMeters = provider.service_radius * 1000
      return provider.distance_meters <= serviceRadiusMeters
    })

    console.log(`Found ${providersWithTokens.length} nearby providers with push tokens`)

    if (providersWithTokens.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No nearby providers with push tokens found' }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    const notificationsToSend = []

    // Process each nearby provider (already filtered by distance and service radius)
    for (const provider of providersWithTokens) {
      try {
        // Check if provider offers the requested service type
        const providerServices = provider.services || []
        const requestServiceType = newRequest.service_type

        if (providerServices.length === 0 || providerServices.includes(requestServiceType)) {
          console.log(`Adding notification for provider ${provider.id} (${(provider.distance_meters / 1000).toFixed(1)}km away)`)
          
          notificationsToSend.push({
            pushToken: provider.push_token,
            providerId: provider.id,
            providerName: provider.name,
            distance: (provider.distance_meters / 1000).toFixed(1),
            email: provider.email
          })
        } else {
          console.log(`Skipping provider ${provider.id}: does not offer service ${requestServiceType}`)
        }
      } catch (error) {
        console.error(`Error processing provider ${provider.id}:`, error)
        continue
      }
    }

    console.log(`Sending notifications to ${notificationsToSend.length} providers`)

    // Send push notifications to nearby providers
    const notificationPromises = notificationsToSend.map(async ({ pushToken, providerId, providerName, distance, email }) => {
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

        // Send email if available
        if (email) {
          try {
            const { subject, html } = generateEmail(newRequest, customerName)
            await sendEmail({
              to: email,
              subject,
              html,
              from_name: "RigSnap",
            })
            console.log(`Email sent to provider ${providerId}`)
          } catch (emailError) {
            console.error(`Failed to send email to provider ${providerId}:`, emailError)
          }
        }

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