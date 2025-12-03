import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
  Modal,
  Platform,
} from 'react-native';

import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import { useTheme } from '@/context/ThemeContext';
import {
  Truck,
  Wrench,
  Settings,
  MapPin,
  TriangleAlert as AlertTriangle,
  CircleDot,
  Droplets,
  Zap,
  Navigation,
  Crosshair,
  Camera,
  Image as ImageIcon,
  X,
  Plus,
  // MapPinned,
  // ChevronDown,
  // Globe,
  // Check,
  // Shield,
  // User,
  // Mail,
  // Phone,
} from 'lucide-react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import {
  locationService,
  requestLocationPermission,
  getRandomTruckingLocation,
  formatCoordinates,
} from '@/utils/location';
import {
  uploadImageToCloudinary,
  CloudinaryUploadResponse,
  CloudinaryUploadError,
} from '@/utils/cloudinaryUpload';

const serviceTypes = [
  {
    id: 'towing',
    title: 'Towing Service',
    icon: Truck,
    description: 'Vehicle breakdown or accident towing',
    color: '#2563eb',
  },
  {
    id: 'repair',
    title: 'Road Service',
    icon: Wrench,
    description: 'On-site mechanical repairs',
    color: '#059669',
  },
  {
    id: 'mechanic',
    title: 'Mechanic Service',
    icon: Settings,
    description: 'Professional diagnostic and repair',
    color: '#7c3aed',
  },
  {
    id: 'tire_repair',
    title: 'Mobile Tire Repair',
    icon: CircleDot,
    description: 'Tire replacement and roadside tire services',
    color: '#dc2626',
  },
  {
    id: 'truck_wash',
    title: 'Mobile Truck Wash',
    icon: Droplets,
    description: 'Professional mobile truck cleaning',
    color: '#0891b2',
  },
  {
    id: 'hose_repair',
    title: 'Hose Repair',
    icon: Zap,
    description: 'Hydraulic and air hose repair',
    color: '#ea580c',
  },
];

const urgencyLevels = [
  {
    id: 'low',
    label: 'Low',
    color: '#10b981',
    description: 'Can wait a few hours',
  },
  {
    id: 'medium',
    label: 'Medium',
    color: '#f59e0b',
    description: 'Need help within 1-2 hours',
  },
  {
    id: 'high',
    label: 'High',
    color: '#ef4444',
    description: 'Emergency - need immediate help',
  },
];

export default function CreateRequestScreen() {
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const { createRequest } = useApp();
  const { colors } = useTheme();

  const [selectedService, setSelectedService] = useState(
    (params.type as string) || ''
  );
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [coordinates, setCoordinates] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [urgency, setUrgency] = useState<'low' | 'medium' | 'high'>('medium');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  // Photo-related state
  const [photos, setPhotos] = useState<string[]>([]);
  const [cloudinaryUrls, setCloudinaryUrls] = useState<string[]>([]);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<CameraType>('back');
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [cameraRef, setCameraRef] = useState<any>(null);
  const [isTakingPhoto, setIsTakingPhoto] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  if (!user) return null;

  const userLanguage = user.language || 'en';

  const getCurrentLocation = async () => {
    setIsGettingLocation(true);

    try {
      // First check if location services are available
      if (!locationService.isLocationAvailable()) {
        Alert.alert(
          'Location Not Available',
          'Your device or browser does not support location services. You can still enter your location manually.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Request permission and get location
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        return;
      }

      // Get current position
      const locationResult = await locationService.getCurrentPosition();
      const { latitude, longitude } = locationResult.coords;

      setCoordinates({ latitude, longitude });

      // Get human-readable address
      try {
        const address = await locationService.reverseGeocode(
          latitude,
          longitude
        );
        setLocation(address);

        Alert.alert(
          'Location Found! 📍',
          `Your current location has been set to:\n\n${address}`,
          [{ text: 'OK' }]
        );
      } catch (geocodeError) {
        // If reverse geocoding fails, still use coordinates
        const coordString = formatCoordinates(latitude, longitude);
        setLocation(coordString);

        Alert.alert(
          'Location Found! 📍',
          `Your GPS coordinates have been set. You can edit the location description if needed.\n\nCoordinates: ${coordString}`,
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      console.error('Location error:', error);

      // Offer fallback options
      Alert.alert(
        'Location Error',
        error.message || 'Unable to get your current location.',
        [
          { text: 'Enter Manually', style: 'cancel' },
          {
            text: 'Use Demo Location',
            onPress: () => {
              const demoLocation = getRandomTruckingLocation();
              setLocation(demoLocation.name);
              setCoordinates(demoLocation.coordinates);

              Alert.alert(
                'Demo Location Set',
                `Using demo location: ${demoLocation.name}`,
                [{ text: 'OK' }]
              );
            },
          },
        ]
      );
    } finally {
      setIsGettingLocation(false);
    }
  };

  const openCamera = async () => {
    if (Platform.OS === 'web') {
      Alert.alert(
        'Camera Not Available',
        'Camera functionality is not available on web. In a real mobile app, this would open the camera.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (!cameraPermission) {
      return;
    }

    if (!cameraPermission.granted) {
      const permission = await requestCameraPermission();
      if (!permission.granted) {
        Alert.alert(
          'Camera Permission Required',
          'Please grant camera permission to take photos of the issue.',
          [{ text: 'OK' }]
        );
        return;
      }
    }

    setShowCameraModal(true);
  };

  const takePicture = async () => {
    if (!cameraRef || isTakingPhoto) return;

    setIsTakingPhoto(true);
    try {
      const photo = await cameraRef.takePictureAsync({
        quality: 0.8,
        base64: false,
      });

      // Add local photo to state immediately for preview
      setPhotos((prev) => [...prev, photo.uri]);
      setShowCameraModal(false);
      
      // Upload to Cloudinary in background
      setIsUploadingPhoto(true);
      try {
        const cloudinaryResponse = await uploadImageToCloudinary(photo.uri, {
          folder: 'service-requests',
          timeout: 60000, // 60 seconds timeout
          retries: 2, // Retry up to 2 times
        });
        
        // Add Cloudinary URL to state
        setCloudinaryUrls((prev) => [...prev, cloudinaryResponse.secure_url]);
        
        Alert.alert(
          'Photo Uploaded! 📸',
          'Your photo has been successfully uploaded and will be included with your service request.',
          [{ text: 'OK' }]
        );
      } catch (uploadError) {
        console.error('Cloudinary upload error:', uploadError);
        Alert.alert(
          'Upload Warning ⚠️',
          'Photo was taken but upload to cloud failed. The photo will still be included locally. Please check your internet connection.',
          [{ text: 'OK' }]
        );
      } finally {
        setIsUploadingPhoto(false);
      }
    } catch {
      Alert.alert('Error', 'Failed to take picture. Please try again.');
    } finally {
      setIsTakingPhoto(false);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setCloudinaryUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const addSamplePhoto = () => {
    // For web demo, add a sample photo
    const samplePhotos = [
      'https://images.pexels.com/photos/3807277/pexels-photo-3807277.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/190574/pexels-photo-190574.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/3807278/pexels-photo-3807278.jpeg?auto=compress&cs=tinysrgb&w=800',
    ];

    const randomPhoto =
      samplePhotos[Math.floor(Math.random() * samplePhotos.length)];
    setPhotos((prev) => [...prev, randomPhoto]);
  };

  const handleSubmit = async () => {
    if (!selectedService || !description || !location) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    // Check if photos are still uploading
    if (isUploadingPhoto) {
      Alert.alert(
        'Photos Uploading',
        'Please wait for photos to finish uploading before submitting your request.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsLoading(true);
    try {
      console.log('User:', user);
      console.log('Local photos:', photos);
      console.log('Cloudinary URLs:', cloudinaryUrls);
      
      const finalPhotos = cloudinaryUrls.length > 0 ? cloudinaryUrls : (photos.length > 0 ? photos : undefined);
      console.log('Final photos for request:', finalPhotos);
      
      const requestData = {
        truckerId: user.id,
        truckerName: `${user.firstName} ${user.lastName}`,
        truckerPhone: user.phone,
        serviceType: selectedService as any,
        description,
        location,
        coordinates: coordinates || {
          latitude: 32.7767 + (Math.random() - 0.5) * 0.1,
          longitude: -96.797 + (Math.random() - 0.5) * 0.1,
        },
        status: 'pending' as const,
        urgency,
        estimatedCost: estimatedCost ? parseInt(estimatedCost) : undefined,
        photos: finalPhotos,
      };

      console.log('Request data being submitted:', requestData);

      // This will now charge $5 and save to database
      await createRequest(requestData);

      Alert.alert(
        'Request Created! 🚛💳',
        'Your service request has been posted and the $5 request fee will be charged when any service provider accepts your request. Service providers in your area will be notified and can accept your request.',
        [
          {
            text: 'View Request',
            onPress: () => router.push('/(tabs)'),
          },
        ]
      );
    } catch (error: any) {
      console.error('Error creating request:', error);
      Alert.alert(
        'Request Failed',
        error.message ||
          'Failed to create request. Please check your payment method and try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View style={styles.content}>
        <View style={[styles.header, { backgroundColor: colors.background }]}>
          <Text style={[styles.title, { color: colors.text }]}>
            Request Service
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Get help from trusted service providers
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Service Type
          </Text>
          <View style={styles.serviceGrid}>
            {serviceTypes.map((service) => {
              const Icon = service.icon;
              const isSelected = selectedService === service.id;

              return (
                <TouchableOpacity
                  key={service.id}
                  style={[
                    [
                      styles.serviceCard,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                    ],
                    isSelected && {
                      borderColor: service.color,
                      backgroundColor: service.color + '10',
                    },
                  ]}
                  onPress={() => setSelectedService(service.id)}
                >
                  <Icon
                    size={28}
                    color={isSelected ? service.color : '#6b7280'}
                  />
                  <Text
                    style={[
                      [styles.serviceTitle, { color: colors.text }],
                      isSelected && { color: service.color },
                    ]}
                  >
                    {service.title}
                  </Text>
                  <Text
                    style={[
                      styles.serviceDescription,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {service.description}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Description & Photos
          </Text>
          <TextInput
            style={[
              styles.textArea,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe the problem in detail. Include truck type, symptoms, and any other relevant information..."
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          {/* Photo Section */}
          <View style={styles.photoSection}>
            <View style={styles.photoHeader}>
              <Text style={[styles.photoTitle, { color: colors.text }]}>
                Add Photos (Optional)
              </Text>
              <Text
                style={[styles.photoSubtitle, { color: colors.textSecondary }]}
              >
                Help providers understand the issue better
              </Text>
            </View>

            <View style={styles.photoGrid}>
              {photos.map((photo, index) => (
                <View key={index} style={styles.photoContainer}>
                  <Image source={{ uri: photo }} style={styles.photoPreview} />
                  <TouchableOpacity
                    style={styles.removePhotoButton}
                    onPress={() => removePhoto(index)}
                  >
                    <X size={16} color="white" />
                  </TouchableOpacity>
                </View>
              ))}

              {photos.length < 3 && (
                <TouchableOpacity
                  style={[
                    styles.addPhotoButton,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.card,
                    },
                  ]}
                  onPress={Platform.OS === 'web' ? addSamplePhoto : openCamera}
                >
                  <View style={styles.addPhotoContent}>
                    {Platform.OS === 'web' ? (
                      <ImageIcon size={24} color={colors.textSecondary} />
                    ) : (
                      <Camera size={24} color={colors.textSecondary} />
                    )}
                    <Text
                      style={[
                        styles.addPhotoText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {Platform.OS === 'web' ? 'Add Sample' : 'Take Photo'}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>

            {photos.length > 0 && (
              <View
                style={[
                  styles.photoTip,
                  {
                    backgroundColor: colors.primary + '20',
                    borderColor: colors.primary + '40',
                  },
                ]}
              >
                <Text style={[styles.photoTipText, { color: colors.primary }]}>
                  📸 {photos.length}/3 photos added. {cloudinaryUrls.length > 0 ? `${cloudinaryUrls.length} uploaded to cloud.` : ''} Clear photos help providers give accurate estimates.
                </Text>
              </View>
            )}
            
            {isUploadingPhoto && (
              <View
                style={[
                  styles.uploadingIndicator,
                  {
                    backgroundColor: colors.warning + '20',
                    borderColor: colors.warning + '40',
                  },
                ]}
              >
                <ActivityIndicator size="small" color={colors.warning} />
                <Text style={[styles.uploadingText, { color: colors.warning }]}>
                  Uploading photo to cloud storage...
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Location
          </Text>
          <View style={styles.locationContainer}>
            <View
              style={[
                styles.inputContainer,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <MapPin
                size={20}
                color={colors.textSecondary}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.inputWithIcon, { color: colors.text }]}
                value={location}
                onChangeText={setLocation}
                placeholder="Enter your current location or address"
                placeholderTextColor={colors.textSecondary}
                multiline
              />
            </View>

            <View style={styles.locationActions}>
              <TouchableOpacity
                style={[
                  [
                    styles.locationButton,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.primary,
                    },
                  ],
                  isGettingLocation && [
                    {
                      borderColor: colors.textSecondary,
                      backgroundColor: colors.card,
                    },
                  ],
                ]}
                onPress={getCurrentLocation}
                disabled={isGettingLocation}
              >
                <View style={styles.locationButtonContent}>
                  {isGettingLocation ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Crosshair size={18} color={colors.primary} />
                  )}
                  <Text
                    style={[
                      [styles.locationButtonText, { color: colors.primary }],
                      isGettingLocation && { color: colors.textSecondary },
                    ]}
                  >
                    {isGettingLocation
                      ? 'Getting Location...'
                      : 'Use Current Location'}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {coordinates && (
            <View
              style={[
                styles.coordinatesInfo,
                {
                  backgroundColor: colors.success + '20',
                  borderColor: colors.success + '40',
                },
              ]}
            >
              <Navigation size={14} color={colors.success} />
              <Text style={[styles.coordinatesText, { color: colors.success }]}>
                GPS:{' '}
                {formatCoordinates(coordinates.latitude, coordinates.longitude)}
              </Text>
            </View>
          )}

          <View
            style={[
              styles.locationTip,
              {
                backgroundColor: colors.warning + '20',
                borderColor: colors.warning + '40',
              },
            ]}
          >
            <Text style={[styles.locationTipText, { color: colors.warning }]}>
              💡 Tip: Accurate location helps service providers find you
              quickly. Include mile markers, exit numbers, or nearby landmarks.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Urgency Level
          </Text>
          <View style={styles.urgencyContainer}>
            {urgencyLevels.map((level) => (
              <TouchableOpacity
                key={level.id}
                style={[
                  [
                    styles.urgencyCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ],
                  urgency === level.id && {
                    borderColor: level.color,
                    backgroundColor: level.color + '10',
                  },
                ]}
                onPress={() =>
                  setUrgency(level.id as 'low' | 'medium' | 'high')
                }
              >
                <View style={styles.urgencyHeader}>
                  <View
                    style={[
                      styles.urgencyDot,
                      { backgroundColor: level.color },
                    ]}
                  />
                  <Text
                    style={[
                      [styles.urgencyLabel, { color: colors.text }],
                      urgency === level.id && { color: level.color },
                    ]}
                  >
                    {level.label}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.urgencyDescription,
                    { color: colors.textSecondary },
                  ]}
                >
                  {level.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Estimated Cost (Optional)
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
            value={estimatedCost}
            onChangeText={setEstimatedCost}
            placeholder="Enter estimated cost in USD"
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
          />
          <Text style={[styles.helperText, { color: colors.textSecondary }]}>
            This helps providers understand the scope of work and provide
            accurate quotes
          </Text>
        </View>

        {/* <View
          style={[
            styles.feeNotice,
            {
              backgroundColor: colors.warning + '20',
              borderColor: colors.warning + '40',
            },
          ]}
        >
          <AlertTriangle size={20} color={colors.warning} />
          <View style={styles.feeText}>
            <Text style={[styles.feeTitle, { color: colors.warning }]}>
              Lead Fee Notice
            </Text>
            <Text style={[styles.feeDescription, { color: colors.warning }]}>
              A $5 lead fee will be charged when a service provider accepts your
              request. This ensures serious commitment from both parties and
              helps maintain platform quality.
            </Text>
          </View>
        </View> */}

        <TouchableOpacity
          style={[
            styles.submitButton,
            { backgroundColor: colors.primary },
            isLoading && styles.buttonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Plus size={20} color="white" />
              <Text style={styles.submitButtonText}>Post Request</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Camera Modal */}
      {Platform.OS !== 'web' && (
        <Modal
          visible={showCameraModal}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => setShowCameraModal(false)}
        >
          <View style={styles.cameraContainer}>
            {cameraPermission?.granted ? (
              <>
                <CameraView
                  style={styles.camera}
                  facing={cameraFacing}
                  ref={setCameraRef}
                />
                <View style={styles.cameraOverlay}>
                  <View style={styles.cameraHeader}>
                    <TouchableOpacity
                      style={styles.cameraCloseButton}
                      onPress={() => setShowCameraModal(false)}
                    >
                      <X size={24} color="white" />
                    </TouchableOpacity>
                    <Text style={styles.cameraTitle}>Take Photo</Text>
                    <TouchableOpacity
                      style={styles.cameraFlipButton}
                      onPress={() =>
                        setCameraFacing((current) =>
                          current === 'back' ? 'front' : 'back'
                        )
                      }
                    >
                      <Camera size={24} color="white" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.cameraFooter}>
                    <TouchableOpacity
                      style={[
                        styles.captureButton,
                        isTakingPhoto && styles.captureButtonDisabled,
                      ]}
                      onPress={takePicture}
                      disabled={isTakingPhoto}
                    >
                      {isTakingPhoto ? (
                        <ActivityIndicator color="white" />
                      ) : (
                        <View style={styles.captureButtonInner} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.permissionContainer}>
                <Camera size={64} color="#6b7280" />
                <Text style={styles.permissionTitle}>
                  Camera Permission Required
                </Text>
                <Text style={styles.permissionText}>
                  We need access to your camera to take photos of the issue
                </Text>
                <TouchableOpacity
                  style={styles.permissionButton}
                  onPress={requestCameraPermission}
                >
                  <Text style={styles.permissionButtonText}>
                    Grant Permission
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </Modal>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 24,
  },
  header: {
    marginTop: 40,
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  serviceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  serviceCard: {
    width: '48%',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    minHeight: 120,
  },
  serviceTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 4,
    textAlign: 'center',
  },
  serviceDescription: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 100,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  photoSection: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  photoHeader: {
    marginBottom: 16,
  },
  photoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  photoSubtitle: {
    fontSize: 14,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  photoContainer: {
    position: 'relative',
    width: 80,
    height: 80,
  },
  photoPreview: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  removePhotoButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  addPhotoButton: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoContent: {
    alignItems: 'center',
    gap: 4,
  },
  addPhotoText: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
  },
  photoTip: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  photoTipText: {
    fontSize: 12,
    lineHeight: 16,
  },
  uploadingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  uploadingText: {
    fontSize: 12,
    fontWeight: '500',
  },
  locationContainer: {
    gap: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  inputIcon: {
    marginLeft: 12,
    marginRight: 8,
    marginTop: 16,
  },
  inputWithIcon: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    paddingLeft: 0,
    minHeight: 50,
  },
  locationActions: {
    flexDirection: 'row',
    gap: 12,
  },
  locationButton: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  locationButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  locationButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  coordinatesInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    padding: 12,
    gap: 8,
    borderWidth: 1,
  },
  coordinatesText: {
    fontSize: 12,
    fontFamily: 'monospace',
    fontWeight: '500',
  },
  locationTip: {
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
  },
  locationTipText: {
    fontSize: 12,
    lineHeight: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  helperText: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  urgencyContainer: {
    gap: 12,
  },
  urgencyCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  urgencyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  urgencyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  urgencyLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  urgencyDescription: {
    fontSize: 14,
  },
  feeNotice: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    alignItems: 'flex-start',
    borderWidth: 1,
  },
  feeText: {
    flex: 1,
    marginLeft: 12,
  },
  feeTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  feeDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  submitButton: {
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonDisabled: {
    backgroundColor: '#94a3b8',
    shadowOpacity: 0.1,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  // Camera Modal Styles
  cameraContainer: {
    flex: 1,
    backgroundColor: 'black',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    zIndex: 1,
  },
  cameraHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  cameraCloseButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  cameraFlipButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraFooter: {
    alignItems: 'center',
    paddingBottom: 40,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  captureButtonDisabled: {
    opacity: 0.6,
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2563eb',
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'white',
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginTop: 24,
    marginBottom: 12,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  permissionButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
