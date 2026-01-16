import { supabase } from '../lib/supabase';
import { ServiceRequest } from '../types';
import { calculateDistance } from './location';

export interface DatabaseRequest {
  id: string;
  trucker_id: string;
  provider_id?: string;
  location: string;
  coordinates: string;
  service_type: string;
  urgency: string;
  description: string;
  estimated_cost: number;
  photos?: string[];
  status: string;
  created_at: string;
  accepted_at?: string;
}

// Fetch all requests from database
export const fetchAllRequests = async (): Promise<ServiceRequest[]> => {
  try {
    // First get all requests
    const { data: requestsData, error: requestsError } = await supabase
      .from('requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (requestsError) {
      console.error('Error fetching requests:', requestsError);
      return [];
    }

    if (!requestsData || requestsData.length === 0) {
      return [];
    }

    // Get all unique user IDs from requests
    const userIds = [...new Set([
      ...requestsData.map(r => r.trucker_id),
      ...requestsData.filter(r => r.provider_id).map(r => r.provider_id)
    ])];

    // Fetch all users in one query
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('id, name, phone')
      .in('id', userIds);

    if (usersError) {
      console.error('Error fetching users:', usersError);
    }

    // Create a map for quick user lookup
    const usersMap = new Map();
    if (usersData) {
      usersData.forEach(user => {
        usersMap.set(user.id, user);
      });
    }

    console.log('Fetched requests:', requestsData.length);
    console.log('Fetched users:', usersData?.length || 0);
    // console.log('Request statuses:', requestsData.map(r => ({ id: r.id.slice(0, 8), status: r.status })));

    // Transform requests and add user data
    const requests = requestsData.map((dbRequest) => {
      const serviceRequest = transformDatabaseRequestToServiceRequest(dbRequest);
      
      // Update with actual user data
      const trucker = usersMap.get(dbRequest.trucker_id);
      if (trucker) {
        serviceRequest.truckerName = trucker.name || 'Unknown User';
        serviceRequest.truckerPhone = trucker.phone || '';
      }
      
      if (dbRequest.provider_id) {
        const provider = usersMap.get(dbRequest.provider_id);
        if (provider) {
          serviceRequest.providerName = provider.name || 'Unknown Provider';
        }
      }
      
      return serviceRequest;
    });

    return requests;
  } catch (error) {
    console.error('Error fetching requests:', error);
    return [];
  }
};

// Fetch requests for a specific user (trucker)
export const fetchUserRequests = async (userId: string): Promise<ServiceRequest[]> => {
  try {
    // First get user's requests
    const { data: requestsData, error: requestsError } = await supabase
      .from('requests')
      .select('*')
      .eq('trucker_id', userId)
      .order('created_at', { ascending: false });

    if (requestsError) {
      console.error('Error fetching user requests:', requestsError);
      return [];
    }

    if (!requestsData || requestsData.length === 0) {
      return [];
    }

    // Get all unique user IDs (trucker + providers)
    const userIds = [...new Set([
      userId, // The trucker
      ...requestsData.filter(r => r.provider_id).map(r => r.provider_id)
    ])];

    // Fetch all users in one query
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('id, name, phone')
      .in('id', userIds);

    if (usersError) {
      console.error('Error fetching users:', usersError);
    }

    // Create a map for quick user lookup
    const usersMap = new Map();
    if (usersData) {
      usersData.forEach(user => {
        usersMap.set(user.id, user);
      });
    }

    console.log('User requests:', requestsData.length);
    console.log('Users found:', usersData?.length || 0);

    // Transform requests and add user data
    const requests = requestsData.map((dbRequest) => {
      const serviceRequest = transformDatabaseRequestToServiceRequest(dbRequest);
      
      // Update with actual user data
      const trucker = usersMap.get(dbRequest.trucker_id);
      if (trucker) {
        serviceRequest.truckerName = trucker.name || 'Unknown User';
        serviceRequest.truckerPhone = trucker.phone || '';
      }
      
      if (dbRequest.provider_id) {
        const provider = usersMap.get(dbRequest.provider_id);
        if (provider) {
          serviceRequest.providerName = provider.name || 'Unknown Provider';
        }
      }
      
      return serviceRequest;
    });

    return requests;
  } catch (error) {
    console.error('Error fetching user requests:', error);
    return [];
  }
};

// Fetch available requests for service providers (pending requests)
export const fetchAvailableRequests = async (providerId?: string): Promise<ServiceRequest[]> => {
  try {
    // Get provider details for radius filtering
    let providerData = null;
    if (providerId) {
      const { data, error } = await supabase
        .from('users')
        .select('location, service_radius, services')
        .eq('id', providerId)
        .single();
      
      if (error) {
        console.error('Error fetching provider data:', error);
      } else {
        providerData = data;
        console.log('Provider data for radius filtering:', JSON.stringify(providerData, null, 2));
      }
    }

    // First get pending requests
    const { data: requestsData, error: requestsError } = await supabase
      .from('requests')
      .select('*')
      .eq('status', 'pending')
      .is('provider_id', null)
      .order('created_at', { ascending: false });

    if (requestsError) {
      console.error('Error fetching available requests:', requestsError);
      return [];
    }

    if (!requestsData || requestsData.length === 0) {
      return [];
    }

    // Get all trucker IDs
    const truckerIds = requestsData.map(r => r.trucker_id);

    // Fetch all truckers in one query
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('id, name, phone')
      .in('id', truckerIds);

    if (usersError) {
      console.error('Error fetching truckers:', usersError);
    }

    // Create a map for quick user lookup
    const usersMap = new Map();
    if (usersData) {
      usersData.forEach(user => {
        usersMap.set(user.id, user);
      });
    }

    console.log('Available requests:', requestsData.length);
    console.log('Truckers found:', usersData?.length || 0);

    // Transform requests and add user data
    let requests = requestsData.map((dbRequest) => {
      const serviceRequest = transformDatabaseRequestToServiceRequest(dbRequest);
      
      // Update with actual user data
      const trucker = usersMap.get(dbRequest.trucker_id);
      
      if (trucker) {
        serviceRequest.truckerName = trucker.name || 'Unknown User';
        serviceRequest.truckerPhone = trucker.phone || '';
      } else {
        console.warn(`No trucker found for ID: ${dbRequest.trucker_id}`);
        serviceRequest.truckerName = 'User Not Found';
      }
      
      return serviceRequest;
    });

    // Apply radius-based filtering if provider data is available
    if (providerData && providerData.service_radius && providerData.location) {
      try {
        // Parse provider location coordinates
        let providerCoords = null;
        
        // Try to extract coordinates from location string
        // Format could be "lat,lng" or a place name like "Lahore"
        if (providerData.location.includes(',')) {
          const parts = providerData.location.split(',');
          if (parts.length >= 2) {
            const lat = parseFloat(parts[0].trim());
            const lng = parseFloat(parts[1].trim());
            if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
              providerCoords = { latitude: lat, longitude: lng };
              console.log(`Parsed provider coordinates: ${lat}, ${lng}`);
            }
          }
        } else {
          // Handle place names with fallback coordinates
          console.log(`Provider has location as place name: ${providerData.location}`);
          
          // Use fallback coordinates for common locations
          if (providerData.location.toLowerCase().includes('lahore')) {
            providerCoords = { latitude: 31.5204, longitude: 74.3587 };
          } else if (providerData.location.toLowerCase().includes('nashville')) {
            providerCoords = { latitude: 36.1627, longitude: -86.7816 };
          } else if (providerData.location.toLowerCase().includes('karachi')) {
            providerCoords = { latitude: 24.8607, longitude: 67.0011 };
          } else if (providerData.location.toLowerCase().includes('islamabad')) {
            providerCoords = { latitude: 33.6844, longitude: 73.0479 };
          } else {
            // Default fallback to a central location
            providerCoords = { latitude: 31.5204, longitude: 74.3587 }; // Lahore as default
          }
          
          console.log(`Using fallback coordinates for ${providerData.location}: ${providerCoords.latitude}, ${providerCoords.longitude}`);
        }

        if (providerCoords) {
          const maxDistance = providerData.service_radius; // in miles
          
          requests = requests.filter((request) => {
            try {
              // Parse request coordinates
              let requestCoords = null;
              
              if (request.coordinates) {
                // Handle different coordinate formats
                if (typeof request.coordinates === 'string') {
                  try {
                    const parsed = JSON.parse(request.coordinates);
                    if (parsed.latitude && parsed.longitude) {
                      requestCoords = { latitude: parsed.latitude, longitude: parsed.longitude };
                    }
                  } catch {
                    // If JSON parse fails, try comma-separated format
                    if (request.coordinates.includes(',')) {
                      const parts = request.coordinates.split(',');
                      if (parts.length >= 2) {
                        const lat = parseFloat(parts[0].trim());
                        const lng = parseFloat(parts[1].trim());
                        if (!isNaN(lat) && !isNaN(lng)) {
                          requestCoords = { latitude: lat, longitude: lng };
                        }
                      }
                    }
                  }
                } else if (typeof request.coordinates === 'object' && request.coordinates.latitude && request.coordinates.longitude) {
                  requestCoords = { latitude: request.coordinates.latitude, longitude: request.coordinates.longitude };
                }
              }

              if (!requestCoords) {
                console.warn(`Could not parse coordinates for request ${request.id}:`, request.coordinates);
                return true; // Include requests without coordinates for now (don't break existing functionality)
              }

              // Calculate distance between provider and request
              const distance = calculateDistance(
                providerCoords.latitude,
                providerCoords.longitude,
                requestCoords.latitude,
                requestCoords.longitude
              );

              // Also filter by services if provider has specific services
              const serviceMatch = !providerData.services || 
                                 providerData.services.length === 0 || 
                                 providerData.services.includes(request.serviceType);

              console.log(`Request ${request.id}: Distance ${distance.toFixed(2)} miles, Max: ${maxDistance}, Service match: ${serviceMatch}`);
              
              return distance <= maxDistance && serviceMatch;
            } catch (error) {
              console.error(`Error calculating distance for request ${request.id}:`, error);
              return true; // Include on error to avoid breaking functionality
            }
          });

          console.log(`Filtered requests by radius: ${requests.length} requests within ${maxDistance} miles of provider location`);
        } else {
          console.warn('Could not parse provider coordinates from location:', providerData.location);
          console.log('Provider data:', providerData);
        }
        
        // Also filter by services even if we don't have coordinates
        if (providerData.services && providerData.services.length > 0) {
          requests = requests.filter((request) => 
            providerData.services.includes(request.serviceType)
          );
          console.log(`Filtered by services: ${requests.length} requests matching provider services`);
        }
      } catch (error) {
        console.error('Error applying radius filter:', error);
      }
    }

    return requests;
  } catch (error) {
    console.error('Error fetching available requests:', error);
    return [];
  }
};

// Fetch requests assigned to a specific service provider
export const fetchProviderRequests = async (providerId: string): Promise<ServiceRequest[]> => {
  try {
    // First get provider's requests
    const { data: requestsData, error: requestsError } = await supabase
      .from('requests')
      .select('*')
      .eq('provider_id', providerId)
      .order('created_at', { ascending: false });

    if (requestsError) {
      console.error('Error fetching provider requests:', requestsError);
      return [];
    }

    if (!requestsData || requestsData.length === 0) {
      return [];
    }

    // Get all unique user IDs (truckers + the provider)
    const userIds = [...new Set([
      providerId, // The provider
      ...requestsData.map(r => r.trucker_id)
    ])];

    // Fetch all users in one query
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('id, name, phone')
      .in('id', userIds);

    if (usersError) {
      console.error('Error fetching users:', usersError);
    }

    // Create a map for quick user lookup
    const usersMap = new Map();
    if (usersData) {
      usersData.forEach(user => {
        usersMap.set(user.id, user);
      });
    }

    console.log('Provider requests:', requestsData.length);
    console.log('Users found:', usersData?.length || 0);

    // Transform requests and add user data
    const requests = requestsData.map((dbRequest) => {
      const serviceRequest = transformDatabaseRequestToServiceRequest(dbRequest);
      
      // Update with actual user data
      const trucker = usersMap.get(dbRequest.trucker_id);
      if (trucker) {
        serviceRequest.truckerName = trucker.name || 'Unknown User';
        serviceRequest.truckerPhone = trucker.phone || '';
      }
      
      const provider = usersMap.get(dbRequest.provider_id);
      if (provider) {
        serviceRequest.providerName = provider.name || 'Unknown Provider';
      }
      
      return serviceRequest;
    });

    return requests;
  } catch (error) {
    console.error('Error fetching provider requests:', error);
    return [];
  }
};

// Cache for user data to avoid repeated queries
const userCache = new Map<string, { name: string; phone: string }>();

// Fetch user data by ID
const fetchUserData = async (userId: string): Promise<{ name: string; phone: string }> => {
  if (userCache.has(userId)) {
    return userCache.get(userId)!;
  }

  try {
    console.log('Fetching user data for ID:', userId);
    const { data, error } = await supabase
      .from('users')
      .select('name, phone')
      .eq('id', userId)
      .single();

    console.log('User data fetch result:', { data, error });

    if (!error && data) {
      userCache.set(userId, data);
      return data;
    }
    
    if (error) {
      console.error('Supabase error fetching user data:', error);
    }
  } catch (error) {
    console.error('Exception fetching user data:', error);
  }

  return { name: 'Unknown', phone: '' };
};

// Update request status in database
export const updateRequestStatusInDB = async (
  requestId: string,
  status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled',
  additionalFields?: { completed_at?: string; cancelled_at?: string; cancellation_reason?: string; cancelled_by?: string }
): Promise<{ success: boolean; error?: string }> => {
  try {
    const updateData: any = { status };
    
    if (additionalFields) {
      if (additionalFields.completed_at) updateData.completed_at = additionalFields.completed_at;
      if (additionalFields.cancelled_at) updateData.cancelled_at = additionalFields.cancelled_at;
      if (additionalFields.cancellation_reason) updateData.cancellation_reason = additionalFields.cancellation_reason;
      if (additionalFields.cancelled_by) updateData.cancelled_by = additionalFields.cancelled_by;
    }

    const { error } = await supabase
      .from('requests')
      .update(updateData)
      .eq('id', requestId);

    if (error) {
      console.error('Error updating request status:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Exception updating request status:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
};

// Transform database request to ServiceRequest format
const transformDatabaseRequestToServiceRequest = (dbRequest: any): ServiceRequest => {
  let coordinates;
  try {
    coordinates = typeof dbRequest.coordinates === 'string' 
      ? JSON.parse(dbRequest.coordinates)
      : dbRequest.coordinates;
  } catch {
    coordinates = { latitude: 0, longitude: 0 };
  }

  // Map service types to match the interface
  const serviceTypeMap: { [key: string]: ServiceRequest['serviceType'] } = {
    'towing': 'towing',
    'repair': 'repair', 
    'mechanic': 'mechanic',
    'tire_repair': 'tire_repair',
    'truck_wash': 'truck_wash',
    'hose_repair': 'hose_repair'
  };

  return {
    id: dbRequest.id,
    truckerId: dbRequest.trucker_id,
    truckerName: 'Loading...', // Will be updated later
    truckerPhone: '', // Will be updated later
    serviceType: serviceTypeMap[dbRequest.service_type] || 'repair',
    urgency: dbRequest.urgency as 'low' | 'medium' | 'high',
    description: dbRequest.description,
    location: dbRequest.location,
    coordinates,
    status: dbRequest.status as 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled',
    createdAt: dbRequest.created_at,
    providerId: dbRequest.provider_id,
    providerName: dbRequest.provider_id ? 'Loading...' : undefined, // Only set if provider exists
    acceptedAt: dbRequest.accepted_at,
    leadFeeCharged: true, // Since we charge $5 for all requests now
    estimatedCost: dbRequest.estimated_cost,
    photos: dbRequest.photos || []
  };
};