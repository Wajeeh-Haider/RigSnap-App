import { supabase } from '../lib/supabase';
import { ServiceRequest } from '../types';

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
    console.log('Request statuses:', requestsData.map(r => ({ id: r.id.slice(0, 8), status: r.status })));

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
export const fetchAvailableRequests = async (): Promise<ServiceRequest[]> => {
  try {
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
    const requests = requestsData.map((dbRequest) => {
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