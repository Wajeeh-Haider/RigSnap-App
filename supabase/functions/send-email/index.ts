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
  html?: string
  text?: string
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

// Send email via backend API
async function sendEmail(payload: EmailPayload) {
  const backendUrl = Deno.env.get('EXPO_PUBLIC_BACKEND_URL')

  if (!backendUrl) {
    throw new Error('Backend URL not configured')
  }

  try {
    const response = await fetch(`${backendUrl}/api/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(`Email API error: ${result.error || response.statusText}`)
    }

    return result
  } catch (error) {
    console.error('Failed to send email:', error)
    throw error
  }
}

// Generate email content for new request notifications
function generateRequestNotificationEmail(request: any, customerName: string) {
  const subject = `New Service Request - ${request.service_type || 'Service Needed'}`

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Service Request</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { text-align: center; margin-bottom: 30px; }
            .logo { font-size: 28px; font-weight: bold; color: #4CAF50; margin-bottom: 10px; }
            .title { font-size: 24px; color: #333; margin-bottom: 20px; }
            .content { color: #555; margin-bottom: 30px; }
            .request-details { background-color: #f9f9f9; padding: 20px; border-radius: 5px; margin: 20px 0; }
            .action-button { display: inline-block; background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">RigSnap</div>
                <h1 class="title">New Service Request!</h1>
            </div>

            <div class="content">
                <p>Hello,</p>
                <p>You have a new service request from <strong>${customerName}</strong>. Here are the details:</p>

                <div class="request-details">
                    <h3>Request Details:</h3>
                    <p><strong>Service:</strong> ${request.service_type || 'General Service'}</p>
                    <p><strong>Description:</strong> ${request.description || 'No description provided'}</p>
                    <p><strong>Urgency:</strong> ${request.urgency || 'Normal'}</p>
                    <p><strong>Budget:</strong> $${request.budget || 'Not specified'}</p>
                    ${request.location ? `<p><strong>Location:</strong> ${request.location}</p>` : ''}
                </div>

                <p>Please respond as soon as possible to discuss the details and provide your quote.</p>

                <a href="#" class="action-button">View Request in App</a>
            </div>

            <div class="footer">
                <p>This email was sent by RigSnap</p>
                <p>You received this because you are registered as a service provider in our system.</p>
            </div>
        </div>
    </body>
    </html>
  `

  return { subject, html }
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
    console.log('Processing new request for email notifications:', newRequest.id)

    // Get customer information
    const { data: customer, error: customerError } = await supabaseClient
      .from('users')
      .select('id, name, email')
      .eq('id', newRequest.customer_id)
      .single()

    if (customerError || !customer) {
      console.error('Error fetching customer:', customerError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch customer information' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

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

    // Find nearby service providers who have email notifications enabled
    const { data: providers, error: providersError } = await supabaseClient
      .from('users')
      .select('id, name, email, location, service_radius, services')
      .eq('role', 'provider')
      .not('email', 'is', null)

    if (providersError) {
      console.error('Error fetching providers:', providersError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch providers' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    console.log(`Found ${providers?.length || 0} providers with email addresses`)

    if (!providers || providers.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No providers with email addresses found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    const emailsSent = []

    // Check each provider's location and service radius
    for (const provider of providers) {
      try {
        // Parse provider location
        let providerCoords: Coordinates
        try {
          if (typeof provider.location === 'string') {
            try {
              providerCoords = JSON.parse(provider.location)
            } catch {
              const parts = provider.location.split(',')
              if (parts.length === 2) {
                const lat = parseFloat(parts[0].trim())
                const lng = parseFloat(parts[1].trim())
                if (!isNaN(lat) && !isNaN(lng)) {
                  providerCoords = { latitude: lat, longitude: lng }
                } else {
                  // Default coordinates
                  providerCoords = { latitude: 31.5204, longitude: 74.3587 }
                }
              } else {
                // Default coordinates based on location name
                if (provider.location.toLowerCase().includes('lahore')) {
                  providerCoords = { latitude: 31.5204, longitude: 74.3587 }
                } else if (provider.location.toLowerCase().includes('nashville')) {
                  providerCoords = { latitude: 36.1627, longitude: -86.7816 }
                } else {
                  providerCoords = { latitude: 31.5204, longitude: 74.3587 }
                }
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

        // Calculate distance
        const distance = calculateDistance(
          requestCoords.latitude,
          requestCoords.longitude,
          providerCoords.latitude,
          providerCoords.longitude
        )

        // Use default service radius of 50km if not set
        const serviceRadius = provider.service_radius || 50

        console.log(`Provider ${provider.id} is ${distance.toFixed(2)} km away, service radius: ${serviceRadius} km`)

        // Check if provider is within service radius
        if (distance <= serviceRadius) {
          // Check if provider offers the requested service
          const providerServices = Array.isArray(provider.services)
            ? provider.services
            : provider.services ? [provider.services] : []

          const serviceMatch = !newRequest.service_type ||
            providerServices.length === 0 ||
            providerServices.some((service: string) =>
              service.toLowerCase().includes(newRequest.service_type.toLowerCase())
            )

          if (serviceMatch) {
            try {
              // Generate email content
              const { subject, html } = generateRequestNotificationEmail(newRequest, customer.name)

              // Send email notification
              await sendEmail({
                to: provider.email,
                subject,
                html,
                from_name: "RigSnap"
              })

              emailsSent.push(provider.email)
              console.log(`Email notification sent to provider ${provider.id} (${provider.email})`)

            } catch (emailError) {
              console.error(`Failed to send email to provider ${provider.id}:`, emailError)
            }
          } else {
            console.log(`Provider ${provider.id} doesn't offer service: ${newRequest.service_type}`)
          }
        } else {
          console.log(`Provider ${provider.id} is too far (${distance.toFixed(2)} km > ${provider.service_radius} km)`)
        }

      } catch (error) {
        console.error(`Error processing provider ${provider.id}:`, error)
        continue
      }
    }

    console.log(`Email notifications sent to ${emailsSent.length} providers`)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Email notifications sent to ${emailsSent.length} providers`,
        emails_sent: emailsSent.length,
        recipients: emailsSent
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Email notification function error:', error)

    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to send email notifications'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})