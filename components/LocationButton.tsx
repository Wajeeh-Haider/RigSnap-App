import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator
} from 'react-native';
import { MapPin, Navigation, Share2, Clock } from 'lucide-react-native';
import { mapsService, formatLocationForMaps, isValidMapLocation, type MapLocation } from '@/utils/maps';

interface LocationButtonProps {
  location: string;
  coordinates?: { latitude: number; longitude: number };
  showDirections?: boolean;
  showShare?: boolean;
  showEstimate?: boolean;
  userLocation?: { latitude: number; longitude: number };
  style?: any;
  size?: 'small' | 'medium' | 'large';
  variant?: 'primary' | 'secondary' | 'outline';
}

export default function LocationButton({
  location,
  coordinates,
  showDirections = true,
  showShare = false,
  showEstimate = false,
  userLocation,
  style,
  size = 'medium',
  variant = 'primary'
}: LocationButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [travelInfo, setTravelInfo] = useState<{
    distance: string;
    duration: string;
  } | null>(null);

  const mapLocation = formatLocationForMaps(location, coordinates);
  const isValidLocation = isValidMapLocation(mapLocation);

  const handleGetDirections = async () => {
    if (!isValidLocation) {
      Alert.alert(
        'Invalid Location',
        'Unable to get directions to this location. Please check the address.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsLoading(true);
    try {
      await mapsService.openDirections({
        destination: mapLocation,
        origin: userLocation ? {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude
        } : undefined,
        mode: 'driving'
      });
    } catch (error) {
      console.error('Failed to open directions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewLocation = async () => {
    if (!isValidLocation) {
      Alert.alert(
        'Invalid Location',
        'Unable to view this location on map. Please check the address.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsLoading(true);
    try {
      await mapsService.openLocation(mapLocation);
    } catch (error) {
      console.error('Failed to open location:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleShareLocation = async () => {
    if (!isValidLocation) {
      Alert.alert(
        'Invalid Location',
        'Unable to share this location.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      await mapsService.shareLocation(mapLocation);
    } catch (error) {
      console.error('Failed to share location:', error);
    }
  };

  const handleGetEstimate = async () => {
    if (!isValidLocation || !userLocation) {
      Alert.alert(
        'Cannot Calculate',
        'Unable to calculate travel time. Location or your current position is not available.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsLoading(true);
    try {
      const info = await mapsService.getDirectionsInfo(
        {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude
        },
        mapLocation
      );
      
      if (info) {
        setTravelInfo(info);
        Alert.alert(
          'Travel Estimate',
          `Distance: ${info.distance}\nEstimated time: ${info.duration}`,
          [
            { text: 'Get Directions', onPress: handleGetDirections },
            { text: 'OK', style: 'cancel' }
          ]
        );
      }
    } catch (error) {
      console.error('Failed to get travel estimate:', error);
      Alert.alert('Error', 'Unable to calculate travel time');
    } finally {
      setIsLoading(false);
    }
  };

  const getButtonSize = () => {
    switch (size) {
      case 'small':
        return { padding: 8, iconSize: 16, fontSize: 12 };
      case 'large':
        return { padding: 16, iconSize: 24, fontSize: 16 };
      default:
        return { padding: 12, iconSize: 20, fontSize: 14 };
    }
  };

  const getButtonStyle = () => {
    const baseStyle = [styles.button];
    const buttonSize = getButtonSize();
    
    switch (variant) {
      case 'secondary':
        return [...baseStyle, styles.secondaryButton, { padding: buttonSize.padding }];
      case 'outline':
        return [...baseStyle, styles.outlineButton, { padding: buttonSize.padding }];
      default:
        return [...baseStyle, styles.primaryButton, { padding: buttonSize.padding }];
    }
  };

  const getTextStyle = () => {
    const buttonSize = getButtonSize();
    const baseStyle = [styles.buttonText, { fontSize: buttonSize.fontSize }];
    
    switch (variant) {
      case 'secondary':
        return [...baseStyle, styles.secondaryText];
      case 'outline':
        return [...baseStyle, styles.outlineText];
      default:
        return [...baseStyle, styles.primaryText];
    }
  };

  const buttonSize = getButtonSize();

  if (!isValidLocation) {
    return (
      <View style={[styles.container, style]}>
        <View style={[styles.button, styles.disabledButton, { padding: buttonSize.padding }]}>
          <MapPin size={buttonSize.iconSize} color="#9ca3af" />
          <Text style={[styles.buttonText, styles.disabledText, { fontSize: buttonSize.fontSize }]}>
            Invalid Location
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {/* Main action button */}
      <TouchableOpacity
        style={getButtonStyle()}
        onPress={showDirections ? handleGetDirections : handleViewLocation}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={variant === 'primary' ? 'white' : '#2563eb'} />
        ) : (
          <>
            {showDirections ? (
              <Navigation size={buttonSize.iconSize} color={variant === 'primary' ? 'white' : '#2563eb'} />
            ) : (
              <MapPin size={buttonSize.iconSize} color={variant === 'primary' ? 'white' : '#2563eb'} />
            )}
            <Text style={getTextStyle()}>
              {showDirections ? 'Get Directions' : 'View on Map'}
            </Text>
          </>
        )}
      </TouchableOpacity>

      {/* Additional action buttons */}
      {(showShare || showEstimate) && (
        <View style={styles.additionalActions}>
          {showEstimate && userLocation && (
            <TouchableOpacity
              style={styles.secondaryAction}
              onPress={handleGetEstimate}
              disabled={isLoading}
            >
              <Clock size={16} color="#6b7280" />
              <Text style={styles.secondaryActionText}>
                {travelInfo ? travelInfo.duration : 'Estimate'}
              </Text>
            </TouchableOpacity>
          )}
          
          {showShare && (
            <TouchableOpacity
              style={styles.secondaryAction}
              onPress={handleShareLocation}
              disabled={isLoading}
            >
              <Share2 size={16} color="#6b7280" />
              <Text style={styles.secondaryActionText}>Share</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Travel info display */}
      {travelInfo && (
        <View style={styles.travelInfo}>
          <Text style={styles.travelInfoText}>
            📍 {travelInfo.distance} • ⏱️ {travelInfo.duration}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  primaryButton: {
    backgroundColor: '#2563eb',
  },
  secondaryButton: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#2563eb',
  },
  disabledButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  buttonText: {
    fontWeight: '600',
  },
  primaryText: {
    color: 'white',
  },
  secondaryText: {
    color: '#475569',
  },
  outlineText: {
    color: '#2563eb',
  },
  disabledText: {
    color: '#9ca3af',
  },
  additionalActions: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 6,
    padding: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  secondaryActionText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  travelInfo: {
    backgroundColor: '#f0fdf4',
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    alignItems: 'center',
  },
  travelInfoText: {
    fontSize: 12,
    color: '#166534',
    fontWeight: '500',
  },
});