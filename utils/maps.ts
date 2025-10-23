// Maps utility functions for navigation and directions
import { Platform, Linking, Alert } from 'react-native';

export interface MapLocation {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface DirectionsOptions {
  destination: MapLocation;
  origin?: MapLocation;
  mode?: 'driving' | 'walking' | 'transit' | 'bicycling';
  avoidTolls?: boolean;
  avoidHighways?: boolean;
}

class MapsService {
  /**
   * Open directions to a location using the device's default maps app
   */
  async openDirections(options: DirectionsOptions): Promise<void> {
    const { destination, origin, mode = 'driving', avoidTolls = false, avoidHighways = false } = options;

    try {
      if (Platform.OS === 'web') {
        await this.openWebDirections(options);
      } else {
        await this.openNativeDirections(options);
      }
    } catch (error) {
      console.error('Failed to open directions:', error);
      Alert.alert(
        'Navigation Error',
        'Unable to open directions. Please try again or use your preferred navigation app.',
        [{ text: 'OK' }]
      );
    }
  }

  /**
   * Open directions in web browser using Google Maps
   */
  private async openWebDirections(options: DirectionsOptions): Promise<void> {
    const { destination, origin, mode, avoidTolls, avoidHighways } = options;
    
    let url = 'https://www.google.com/maps/dir/';
    
    // Add origin if provided, otherwise use current location
    if (origin) {
      url += `${origin.latitude},${origin.longitude}/`;
    } else {
      url += 'Current+Location/';
    }
    
    // Add destination
    if (destination.address) {
      url += encodeURIComponent(destination.address);
    } else {
      url += `${destination.latitude},${destination.longitude}`;
    }
    
    // Add parameters
    const params = new URLSearchParams();
    
    if (mode && mode !== 'driving') {
      params.append('dirflg', this.getModeParam(mode));
    }
    
    if (avoidTolls) {
      params.append('avoid', 'tolls');
    }
    
    if (avoidHighways) {
      params.append('avoid', 'highways');
    }
    
    if (params.toString()) {
      url += '?' + params.toString();
    }
    
    // Open in new tab/window
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      throw new Error('Cannot open Google Maps');
    }
  }

  /**
   * Open directions using native mobile apps
   */
  private async openNativeDirections(options: DirectionsOptions): Promise<void> {
    const { destination, origin, mode } = options;
    
    // Try to open with different navigation apps in order of preference
    const apps = [
      this.getGoogleMapsUrl(options),
      this.getAppleMapsUrl(options),
      this.getWazeUrl(options)
    ];
    
    for (const appUrl of apps) {
      if (appUrl) {
        const supported = await Linking.canOpenURL(appUrl);
        if (supported) {
          await Linking.openURL(appUrl);
          return;
        }
      }
    }
    
    // Fallback to web version
    await this.openWebDirections(options);
  }

  /**
   * Generate Google Maps app URL for mobile
   */
  private getGoogleMapsUrl(options: DirectionsOptions): string | null {
    const { destination, origin, mode } = options;
    
    let url = 'comgooglemaps://?';
    const params = new URLSearchParams();
    
    if (destination.address) {
      params.append('daddr', destination.address);
    } else {
      params.append('daddr', `${destination.latitude},${destination.longitude}`);
    }
    
    if (origin) {
      if (origin.address) {
        params.append('saddr', origin.address);
      } else {
        params.append('saddr', `${origin.latitude},${origin.longitude}`);
      }
    }
    
    if (mode) {
      params.append('directionsmode', mode);
    }
    
    return url + params.toString();
  }

  /**
   * Generate Apple Maps URL for iOS
   */
  private getAppleMapsUrl(options: DirectionsOptions): string | null {
    if (Platform.OS !== 'ios') return null;
    
    const { destination, origin } = options;
    
    let url = 'maps://?';
    const params = new URLSearchParams();
    
    if (destination.address) {
      params.append('daddr', destination.address);
    } else {
      params.append('daddr', `${destination.latitude},${destination.longitude}`);
    }
    
    if (origin) {
      if (origin.address) {
        params.append('saddr', origin.address);
      } else {
        params.append('saddr', `${origin.latitude},${origin.longitude}`);
      }
    }
    
    return url + params.toString();
  }

  /**
   * Generate Waze URL
   */
  private getWazeUrl(options: DirectionsOptions): string | null {
    const { destination } = options;
    
    let url = 'waze://?';
    const params = new URLSearchParams();
    
    params.append('ll', `${destination.latitude},${destination.longitude}`);
    params.append('navigate', 'yes');
    
    if (destination.address) {
      params.append('q', destination.address);
    }
    
    return url + params.toString();
  }

  /**
   * Convert mode to Google Maps parameter
   */
  private getModeParam(mode: string): string {
    switch (mode) {
      case 'walking': return 'w';
      case 'transit': return 'r';
      case 'bicycling': return 'b';
      default: return 'd'; // driving
    }
  }

  /**
   * Get estimated travel time and distance
   */
  async getDirectionsInfo(origin: MapLocation, destination: MapLocation): Promise<{
    distance: string;
    duration: string;
    distanceValue: number;
    durationValue: number;
  } | null> {
    try {
      // This would typically use Google Directions API
      // For demo purposes, we'll calculate straight-line distance and estimate time
      const distance = this.calculateDistance(
        origin.latitude,
        origin.longitude,
        destination.latitude,
        destination.longitude
      );
      
      // Estimate driving time (assuming average speed of 45 mph for city/highway mix)
      const estimatedTimeHours = distance / 45;
      const estimatedTimeMinutes = Math.round(estimatedTimeHours * 60);
      
      return {
        distance: `${distance.toFixed(1)} mi`,
        duration: estimatedTimeMinutes < 60 
          ? `${estimatedTimeMinutes} min`
          : `${Math.floor(estimatedTimeMinutes / 60)}h ${estimatedTimeMinutes % 60}m`,
        distanceValue: distance,
        durationValue: estimatedTimeMinutes
      };
    } catch (error) {
      console.error('Failed to get directions info:', error);
      return null;
    }
  }

  /**
   * Calculate straight-line distance between two points
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

  /**
   * Open location in maps app for viewing (not directions)
   */
  async openLocation(location: MapLocation): Promise<void> {
    try {
      let url: string;
      
      if (Platform.OS === 'web') {
        if (location.address) {
          url = `https://www.google.com/maps/search/${encodeURIComponent(location.address)}`;
        } else {
          url = `https://www.google.com/maps/@${location.latitude},${location.longitude},15z`;
        }
      } else {
        // Try native apps first
        const googleMapsUrl = `comgooglemaps://?center=${location.latitude},${location.longitude}&zoom=15`;
        const appleMapsUrl = `maps://?ll=${location.latitude},${location.longitude}`;
        
        if (await Linking.canOpenURL(googleMapsUrl)) {
          url = googleMapsUrl;
        } else if (Platform.OS === 'ios' && await Linking.canOpenURL(appleMapsUrl)) {
          url = appleMapsUrl;
        } else {
          // Fallback to web
          url = `https://www.google.com/maps/@${location.latitude},${location.longitude},15z`;
        }
      }
      
      await Linking.openURL(url);
    } catch (error) {
      console.error('Failed to open location:', error);
      Alert.alert(
        'Maps Error',
        'Unable to open location in maps. Please try again.',
        [{ text: 'OK' }]
      );
    }
  }

  /**
   * Share location with others
   */
  async shareLocation(location: MapLocation): Promise<void> {
    try {
      const url = location.address 
        ? `https://www.google.com/maps/search/${encodeURIComponent(location.address)}`
        : `https://www.google.com/maps/@${location.latitude},${location.longitude},15z`;
      
      const message = location.address 
        ? `My location: ${location.address}\n${url}`
        : `My location: ${location.latitude}, ${location.longitude}\n${url}`;
      
      // On web, copy to clipboard
      if (Platform.OS === 'web' && navigator.clipboard) {
        await navigator.clipboard.writeText(message);
        Alert.alert('Location Copied', 'Location has been copied to clipboard');
      } else {
        // On mobile, would use Share API
        Alert.alert('Share Location', message);
      }
    } catch (error) {
      console.error('Failed to share location:', error);
      Alert.alert('Share Error', 'Unable to share location');
    }
  }
}

// Export singleton instance
export const mapsService = new MapsService();

// Utility functions
export function formatLocationForMaps(location: string, coordinates?: { latitude: number; longitude: number }): MapLocation {
  if (coordinates) {
    return {
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      address: location
    };
  }
  
  // Try to parse coordinates from location string
  const coordMatch = location.match(/(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/);
  if (coordMatch) {
    return {
      latitude: parseFloat(coordMatch[1]),
      longitude: parseFloat(coordMatch[2]),
      address: location
    };
  }
  
  // If no coordinates found, return with address only
  // This will require geocoding when used
  return {
    latitude: 0,
    longitude: 0,
    address: location
  };
}

export function isValidMapLocation(location: MapLocation): boolean {
  return (
    (location.latitude !== 0 || location.longitude !== 0) &&
    location.latitude >= -90 && location.latitude <= 90 &&
    location.longitude >= -180 && location.longitude <= 180
  ) || !!location.address;
}