// Location utility functions for web and mobile compatibility
import { Platform, Alert } from 'react-native';
import * as Location from 'expo-location';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  heading?: number;
  speed?: number;
}

export interface LocationResult {
  coords: LocationCoordinates;
  timestamp: number;
}

export interface LocationError {
  code: number;
  message: string;
}

export interface LocationService {
  getCurrentPosition: () => Promise<LocationResult>;
  watchPosition: (callback: (location: LocationResult) => void, errorCallback?: (error: LocationError) => void) => number;
  clearWatch: (watchId: number) => void;
  reverseGeocode: (latitude: number, longitude: number) => Promise<string>;
  isLocationAvailable: () => boolean;
}

class WebLocationService implements LocationService {
  private watchId: number = 0;
  private activeWatches: Map<number, number> = new Map();

  isLocationAvailable(): boolean {
    return 'geolocation' in navigator;
  }

  async getCurrentPosition(): Promise<LocationResult> {
    if (!this.isLocationAvailable()) {
      throw {
        code: 1,
        message: 'Geolocation is not supported by this browser'
      } as LocationError;
    }

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            coords: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              altitude: position.coords.altitude || undefined,
              heading: position.coords.heading || undefined,
              speed: position.coords.speed || undefined,
            },
            timestamp: position.timestamp
          });
        },
        (error) => {
          reject({
            code: error.code,
            message: this.getErrorMessage(error.code)
          } as LocationError);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 60000
        }
      );
    });
  }

  watchPosition(
    callback: (location: LocationResult) => void, 
    errorCallback?: (error: LocationError) => void
  ): number {
    if (!this.isLocationAvailable()) {
      errorCallback?.({
        code: 1,
        message: 'Geolocation is not supported by this browser'
      });
      return -1;
    }

    const watchId = ++this.watchId;
    
    const nativeWatchId = navigator.geolocation.watchPosition(
      (position) => {
        callback({
          coords: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude || undefined,
            heading: position.coords.heading || undefined,
            speed: position.coords.speed || undefined,
          },
          timestamp: position.timestamp
        });
      },
      (error) => {
        errorCallback?.({
          code: error.code,
          message: this.getErrorMessage(error.code)
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000
      }
    );

    this.activeWatches.set(watchId, nativeWatchId);
    return watchId;
  }

  clearWatch(watchId: number): void {
    const nativeWatchId = this.activeWatches.get(watchId);
    if (nativeWatchId !== undefined) {
      navigator.geolocation.clearWatch(nativeWatchId);
      this.activeWatches.delete(watchId);
    }
  }

  async reverseGeocode(latitude: number, longitude: number): Promise<string> {
    try {
      // Using a free geocoding service (Nominatim OpenStreetMap)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'RigSnap-Mobile-App/1.0'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Geocoding service unavailable');
      }

      const data = await response.json();
      
      if (data && data.display_name) {
        // Format the address for trucking context
        const address = data.address || {};
        const parts = [];

        // Add road/highway information
        if (address.road) {
          parts.push(address.road);
        } else if (address.highway) {
          parts.push(address.highway);
        }

        // Add city/town
        if (address.city) {
          parts.push(address.city);
        } else if (address.town) {
          parts.push(address.town);
        } else if (address.village) {
          parts.push(address.village);
        }

        // Add state
        if (address.state) {
          parts.push(address.state);
        }

        // Add country for international locations
        if (address.country && address.country !== 'United States') {
          parts.push(address.country);
        }

        if (parts.length > 0) {
          return parts.join(', ');
        }

        // Fallback to display name
        return data.display_name;
      }

      throw new Error('No address found');
    } catch (error) {
      console.error('Reverse geocoding failed:', error);
      // Return coordinates as fallback
      return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    }
  }

  private getErrorMessage(code: number): string {
    switch (code) {
      case 1:
        return 'Location access denied. Please enable location permissions in your browser settings.';
      case 2:
        return 'Location unavailable. Please check your GPS settings and internet connection.';
      case 3:
        return 'Location request timed out. Please try again.';
      default:
        return 'An unknown location error occurred.';
    }
  }
}

// Mobile location service using expo-location
class MobileLocationService implements LocationService {
  private watchSubscriptions: Map<number, Location.LocationSubscription> = new Map();
  private watchId: number = 0;

  isLocationAvailable(): boolean {
    return true; // expo-location is available on mobile platforms
  }

  async getCurrentPosition(): Promise<LocationResult> {
    try {
      // Request permissions first
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw {
          code: 1,
          message: 'Location permission denied'
        } as LocationError;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeInterval: 15000,
        distanceInterval: 0,
      });

      return {
        coords: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy || undefined,
          altitude: location.coords.altitude || undefined,
          heading: location.coords.heading || undefined,
          speed: location.coords.speed || undefined,
        },
        timestamp: location.timestamp
      };
    } catch (error: any) {
      throw {
        code: error.code || 2,
        message: error.message || 'Failed to get current position'
      } as LocationError;
    }
  }

  watchPosition(
    callback: (location: LocationResult) => void, 
    errorCallback?: (error: LocationError) => void
  ): number {
    const watchId = ++this.watchId;

    (async () => {
      try {
        // Request permissions first
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          errorCallback?.({
            code: 1,
            message: 'Location permission denied'
          });
          return;
        }

        const subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 10000,
            distanceInterval: 10,
          },
          (location) => {
            callback({
              coords: {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                accuracy: location.coords.accuracy || undefined,
                altitude: location.coords.altitude || undefined,
                heading: location.coords.heading || undefined,
                speed: location.coords.speed || undefined,
              },
              timestamp: location.timestamp
            });
          }
        );

        this.watchSubscriptions.set(watchId, subscription);
      } catch (error: any) {
        errorCallback?.({
          code: error.code || 2,
          message: error.message || 'Failed to watch position'
        });
      }
    })();

    return watchId;
  }

  clearWatch(watchId: number): void {
    const subscription = this.watchSubscriptions.get(watchId);
    if (subscription) {
      subscription.remove();
      this.watchSubscriptions.delete(watchId);
    }
  }

  async reverseGeocode(latitude: number, longitude: number): Promise<string> {
    try {
      const result = await Location.reverseGeocodeAsync({
        latitude,
        longitude
      });

      if (result && result.length > 0) {
        const address = result[0];
        const parts = [];

        // Add road/street information
        if (address.street) {
          parts.push(address.street);
        }

        // Add city
        if (address.city) {
          parts.push(address.city);
        }

        // Add region/state
        if (address.region) {
          parts.push(address.region);
        }

        // Add country for international locations
        if (address.country && address.country !== 'United States') {
          parts.push(address.country);
        }

        if (parts.length > 0) {
          return parts.join(', ');
        }

        // Fallback to any available address component
        if (address.name) {
          return address.name;
        }
      }

      throw new Error('No address found');
    } catch (error) {
      console.error('Reverse geocoding failed:', error);
      // Return coordinates as fallback
      return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    }
  }
}

// Create platform-specific service
export const locationService: LocationService = Platform.OS === 'web' 
  ? new WebLocationService() 
  : new MobileLocationService();

// Utility functions
export function formatCoordinates(latitude: number, longitude: number): string {
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}

export function calculateDistance(
  lat1: number, 
  lon1: number, 
  lat2: number, 
  lon2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export function isValidCoordinates(latitude: number, longitude: number): boolean {
  return (
    latitude >= -90 && latitude <= 90 &&
    longitude >= -180 && longitude <= 180
  );
}

// Common trucking locations for fallback/demo purposes
export const commonTruckingLocations = [
  {
    name: "I-35 Mile Marker 234, Dallas, TX",
    coordinates: { latitude: 32.7767, longitude: -96.7970 }
  },
  {
    name: "I-10 Rest Area, Houston, TX", 
    coordinates: { latitude: 29.7604, longitude: -95.3698 }
  },
  {
    name: "I-20 Truck Stop, Arlington, TX",
    coordinates: { latitude: 32.7357, longitude: -97.1081 }
  },
  {
    name: "Highway 183 Service Road, Irving, TX",
    coordinates: { latitude: 32.8140, longitude: -96.9489 }
  },
  {
    name: "I-45 Mile Marker 156, Huntsville, TX",
    coordinates: { latitude: 30.7235, longitude: -95.5508 }
  },
  {
    name: "I-75 Truck Plaza, Atlanta, GA",
    coordinates: { latitude: 33.7490, longitude: -84.3880 }
  },
  {
    name: "I-40 Rest Stop, Oklahoma City, OK",
    coordinates: { latitude: 35.4676, longitude: -97.5164 }
  },
  {
    name: "I-80 Truck Stop, Des Moines, IA",
    coordinates: { latitude: 41.5868, longitude: -93.6250 }
  }
];

export function getRandomTruckingLocation() {
  const randomIndex = Math.floor(Math.random() * commonTruckingLocations.length);
  return commonTruckingLocations[randomIndex];
}

// Location permission helper
export async function requestLocationPermission(): Promise<boolean> {
  if (!locationService.isLocationAvailable()) {
    Alert.alert(
      'Location Not Available',
      'Your device or browser does not support location services.',
      [{ text: 'OK' }]
    );
    return false;
  }

  try {
    // Test if we can get location (this will trigger permission request)
    await locationService.getCurrentPosition();
    return true;
  } catch (error: any) {
    const locationError = error as LocationError;
    
    if (locationError.code === 1) {
      Alert.alert(
        'Location Permission Required',
        'RigSnap needs access to your location to help service providers find you. Please enable location access in your device settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Open Settings', 
            onPress: () => {
              if (Platform.OS === 'web') {
                // Guide user to browser settings
                Alert.alert(
                  'Enable Location Access',
                  'To enable location access:\n\n1. Click the location icon in your browser\'s address bar\n2. Select "Allow" for location access\n3. Refresh the page and try again',
                  [{ text: 'OK' }]
                );
              } else {
                // On mobile, guide user to device settings
                Alert.alert(
                  'Enable Location Access',
                  'To enable location access:\n\n1. Go to your device Settings\n2. Find RigSnap in the app list\n3. Enable Location permissions\n4. Return to the app and try again',
                  [{ text: 'OK' }]
                );
              }
            }
          }
        ]
      );
    } else {
      Alert.alert(
        'Location Error',
        locationError.message,
        [{ text: 'OK' }]
      );
    }
    
    return false;
  }
}