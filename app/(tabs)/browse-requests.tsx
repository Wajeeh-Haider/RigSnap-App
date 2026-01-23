import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import { useTheme } from '@/context/ThemeContext';
import { paymentMethodService } from '@/utils/paymentOperations';
import {
  Clock,
  CircleCheck as CheckCircle,
  CircleAlert as AlertCircle,
  MapPin,
  Phone,
  DollarSign,
  Filter,
  Truck,
  Wrench,
  Settings,
  CircleDot,
  Droplets,
  Zap,
  X as XIcon,
} from 'lucide-react-native';
import LocationButton from '@/components/LocationButton';
import { locationService } from '@/utils/location';

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending':
      return '#f59e0b';
    case 'accepted':
      return '#3b82f6';
    case 'in_progress':
      return '#8b5cf6';
    case 'completed':
      return '#10b981';
    case 'cancelled':
      return '#ef4444';
    default:
      return '#6b7280';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'pending':
      return Clock;
    case 'accepted':
    case 'in_progress':
      return AlertCircle;
    case 'completed':
      return CheckCircle;
    case 'cancelled':
      return AlertCircle;
    default:
      return Clock;
  }
};

const getServiceIcon = (serviceType: string) => {
  switch (serviceType) {
    case 'towing':
      return Truck;
    case 'repair':
      return Wrench;
    case 'mechanic':
      return Settings;
    case 'tire_repair':
      return CircleDot;
    case 'truck_wash':
      return Droplets;
    case 'hose_repair':
      return Zap;
    default:
      return Truck;
  }
};

const getUrgencyColor = (urgency: string) => {
  switch (urgency) {
    case 'high':
      return '#ef4444';
    case 'medium':
      return '#f59e0b';
    case 'low':
      return '#10b981';
    default:
      return '#6b7280';
  }
};

const filterOptions = [
  'all',
  'towing',
  'repair',
  'mechanic',
  'tire_repair',
  'truck_wash',
  'hose_repair',
];

export default function BrowseRequestsScreen() {
  const { user, updateProfile } = useAuth();
  const {
    getAvailableRequests,
    getUserRequests,
    getProviderRequests,
    acceptRequest,
    cancelRequest,
    refreshRequests,
  } = useApp();
  const { colors } = useTheme();
  const [filter, setFilter] = useState<string>('all');
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [availableRequests, setAvailableRequests] = useState<any[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const locationUpdatedRef = useRef(false);
  const lastLocationUpdateRef = useRef<number>(0);

  const getUserLocation = async () => {
    try {
      if (locationService.isLocationAvailable()) {
        const location = await locationService.getCurrentPosition();
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      }
    } catch (error) {
      console.log('Could not get user location:', error);
    }
  };

  const loadAvailableRequests = async () => {
    if (!user || user.role === 'trucker') return;

    setIsLoadingRequests(true);
    try {
      // Update provider's location with current live location for radius filtering
      // Only update if location has changed significantly and enough time has passed
      if (!locationUpdatedRef.current) {
        try {
          const currentLocation = await locationService.getCurrentPosition();
          const coords = `${currentLocation.coords.latitude},${currentLocation.coords.longitude}`;
          const now = Date.now();
          
          // Skip update if location hasn't changed or updated recently (within 5 minutes)
          if (coords !== user.location && (now - lastLocationUpdateRef.current) > 5 * 60 * 1000) {
            // Update the provider's location in database
            await updateProfile({ location: coords });
            lastLocationUpdateRef.current = now;
            console.log('Updated provider live location for radius filtering:', coords);
          } else {
            console.log('Location unchanged or updated recently, skipping update');
          }
          
          locationUpdatedRef.current = true;
        } catch (locationError) {
          console.error('Failed to get/update live location:', locationError);
          // Continue with request fetching even if location update fails
        }
      }

      const requests = await getAvailableRequests(user.id);
      setAvailableRequests(requests);
    } catch (error) {
      console.error('Error loading available requests:', error);
    } finally {
      setIsLoadingRequests(false);
    }
  };

  // Get user location and load requests on component mount
  useEffect(() => {
    getUserLocation();
    loadAvailableRequests();
  }, [user?.id]);

  // Refresh data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      // Reset location updated flag when screen comes into focus
      locationUpdatedRef.current = false;
      refreshRequests();
      loadAvailableRequests();
    }, [refreshRequests, user?.id])
  );

  if (!user) return null;

  const isTrucker = user.role === 'trucker';

  // Get appropriate requests based on user role
  const requests = isTrucker ? getUserRequests(user.id) : availableRequests;

  const filteredRequests =
    filter === 'all'
      ? requests
      : requests.filter((r) => r.serviceType === filter);

  const handleAcceptRequest = async (request: any) => {
    // First check if user has a payment method
    try {
      // Check for payment methods
      const paymentMethods = await paymentMethodService.fetchUserPaymentMethods(
        user.id
      );

      if (!paymentMethods || paymentMethods.length === 0) {
        Alert.alert(
          'Payment Method Required',
          'You need to add a payment method to accept requests. Would you like to add one now?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Add Payment Method',
              onPress: () => {
                // Navigate to profile/payment methods
                router.push('/profile');
              },
            },
          ]
        );
        return;
      }
    } catch (error) {
      console.error('Error checking payment methods:', error);
    }

    Alert.alert(
      'Accept Request',
      `Are you sure you want to accept this ${request.serviceType.replace(
        '_',
        ' '
      )} request? A $5 lead fee will be charged to both you and the trucker.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            setIsAccepting(true);
            try {
              // Wait for payment confirmation before proceeding
              await acceptRequest(
                request.id,
                user.id,
                `${user.firstName} ${user.lastName}`
              );

              // Refresh data to get updated request status
              await refreshRequests();

              setSelectedRequest(null);
              // Success alert will be shown by acceptRequest function after payment confirmation
            } catch (error: any) {
              console.error('Error accepting request:', error);
              let errorMessage = 'Failed to accept request. Please try again.';

              if (error?.message?.includes('No default payment method')) {
                errorMessage =
                  'Please add a payment method in your profile to accept requests.';
              } else if (error?.message?.includes('card_declined')) {
                errorMessage =
                  'Your card was declined. Please check your payment method.';
              } else if (error?.message?.includes('insufficient_funds')) {
                errorMessage =
                  'Insufficient funds. Please use a different payment method.';
              }

              Alert.alert('Error', errorMessage);
            } finally {
              setIsAccepting(false);
            }
          },
        },
      ]
    );
  };

  const handleCancelRequest = async (request: any) => {
    const isProviderCancellingAccepted = request.status === 'accepted' && request.providerId === user.id;
    const isTruckerCancellingPending = request.status === 'pending' && request.truckerId === user.id;

    if (isProviderCancellingAccepted) {
      Alert.alert(
        'Cancel Request',
        `Are you sure you want to cancel this ${request.serviceType.replace(
          '_',
          ' '
        )} request?\n\n⚠️ Warning: You will be charged a $5 penalty fee in addition to the original $5 lead fee (total $10). The trucker will receive a full refund.`,
        [
          { text: 'Keep Request', style: 'cancel' },
          {
            text: 'Cancel Request',
            style: 'destructive',
            onPress: () => {
              Alert.prompt(
                'Cancellation Reason',
                'Please provide a reason for cancelling this request:',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Submit',
                    onPress: async (reason?: string) => {
                      if (!reason || reason.trim().length === 0) {
                        Alert.alert(
                          'Error',
                          'Please provide a reason for cancellation.'
                        );
                        return;
                      }

                      setIsCancelling(true);
                      try {
                        const success = await cancelRequest(
                          request.id,
                          user.id,
                          reason.trim()
                        );
                        if (success) {
                          setSelectedRequest(null);
                          Alert.alert(
                            'Request Cancelled',
                            'The request has been cancelled. The trucker has been notified and will receive a full refund. You have been charged a $5 penalty fee.',
                            [{ text: 'OK' }]
                          );
                        }
                        // Error alert is already shown in cancelRequest if payment fails
                      } catch {
                        Alert.alert(
                          'Error',
                          'Failed to cancel request. Please try again.'
                        );
                      } finally {
                        setIsCancelling(false);
                      }
                    },
                  },
                ],
                'plain-text',
                '',
                'default'
              );
            },
          },
        ]
      );
    } else if (isTruckerCancellingPending) {
      Alert.alert(
        'Cancel Request',
        `Are you sure you want to cancel this ${request.serviceType.replace(
          '_',
          ' '
        )} request? This action cannot be undone.`,
        [
          { text: 'Keep Request', style: 'cancel' },
          {
            text: 'Cancel Request',
            style: 'destructive',
            onPress: () => {
              Alert.prompt(
                'Cancellation Reason',
                'Please provide a reason for cancelling this request:',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Submit',
                    onPress: async (reason?: string) => {
                      if (!reason || reason.trim().length === 0) {
                        Alert.alert(
                          'Error',
                          'Please provide a reason for cancellation.'
                        );
                        return;
                      }

                      setIsCancelling(true);
                      try {
                        const success = await cancelRequest(
                          request.id,
                          user.id,
                          reason.trim()
                        );
                        if (success) {
                          setSelectedRequest(null);
                          Alert.alert(
                            'Request Cancelled',
                            'Your request has been cancelled successfully.',
                            [{ text: 'OK' }]
                          );
                        }
                      } catch {
                        Alert.alert(
                          'Error',
                          'Failed to cancel request. Please try again.'
                        );
                      } finally {
                        setIsCancelling(false);
                      }
                    },
                  },
                ],
                'plain-text',
                '',
                'default'
              );
            },
          },
        ]
      );
    }
  };

  const getFilterDisplayName = (filterType: string) => {
    switch (filterType) {
      case 'tire_repair':
        return 'Tire Repair';
      case 'truck_wash':
        return 'Truck Wash';
      case 'hose_repair':
        return 'Hose Repair';
      default:
        return filterType.charAt(0).toUpperCase() + filterType.slice(1);
    }
  };

  const getServiceDisplayName = (serviceType: string) => {
    switch (serviceType) {
      case 'tire_repair':
        return 'TIRE REPAIR';
      case 'truck_wash':
        return 'TRUCK WASH';
      case 'hose_repair':
        return 'HOSE REPAIR';
      default:
        return serviceType.toUpperCase();
    }
  };

  const RequestDetailModal = ({
    request,
    onClose,
  }: {
    request: any;
    onClose: () => void;
  }) => {
    if (!request) return null;

    const ServiceIcon = getServiceIcon(request.serviceType);
    const StatusIcon = getStatusIcon(request.status);
    const canCancel =
      (request.status === 'accepted' && request.providerId === user.id) ||
      (request.status === 'pending' && request.truckerId === user.id);

    return (
      <Modal
        visible={!!request}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View
          style={[
            styles.modalContainer,
            { backgroundColor: colors.background },
          ]}
        >
          <View
            style={[
              styles.modalHeader,
              {
                backgroundColor: colors.surface,
                borderBottomColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Request Details
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <XIcon size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={[
              styles.modalContent,
              { backgroundColor: colors.background },
            ]}
          >
            <View
              style={[
                styles.requestDetailCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={styles.serviceHeader}>
                <ServiceIcon size={32} color="#2563eb" />
                <View style={styles.serviceInfo}>
                  <Text
                    style={[
                      styles.serviceTypeDetail,
                      { color: colors.primary },
                    ]}
                  >
                    {getServiceDisplayName(request.serviceType)} SERVICE
                  </Text>
                  <View style={styles.statusRow}>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusColor(request.status) },
                      ]}
                    >
                      <StatusIcon size={12} color="white" />
                      <Text style={styles.statusText}>
                        {request.status.replace('_', ' ').toUpperCase()}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.urgencyBadge,
                        { backgroundColor: getUrgencyColor(request.urgency) },
                      ]}
                    >
                      <Text style={styles.urgencyText}>
                        {request.urgency.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.detailSection}>
                <Text style={[styles.detailTitle, { color: colors.text }]}>
                  Description
                </Text>
                <Text
                  style={[styles.detailText, { color: colors.textSecondary }]}
                >
                  {request.description}
                </Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={[styles.detailTitle, { color: colors.text }]}>
                  Location & Navigation
                </Text>
                <View style={styles.locationContainer}>
                  <View style={styles.detailRow}>
                    <MapPin size={16} color={colors.textSecondary} />
                    <Text
                      style={[
                        styles.detailText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {request.location}
                    </Text>
                  </View>

                  <LocationButton
                    location={request.location}
                    coordinates={request.coordinates}
                    showDirections={true}
                    showEstimate={true}
                    showShare={false}
                    userLocation={userLocation || undefined}
                    style={styles.locationButton}
                    size="medium"
                    variant="primary"
                  />
                </View>
              </View>

              <View style={styles.detailSection}>
                <Text style={[styles.detailTitle, { color: colors.text }]}>
                  Trucker Information
                </Text>
                <View style={styles.detailRow}>
                  <Phone size={16} color={colors.textSecondary} />
                  <Text
                    style={[styles.detailText, { color: colors.textSecondary }]}
                  >
                    {request.truckerName}
                  </Text>
                </View>
                <Text style={[styles.phoneNumber, { color: colors.primary }]}>
                  {request.truckerPhone}
                </Text>
              </View>

              {request.estimatedCost && (
                <View style={styles.detailSection}>
                  <Text style={[styles.detailTitle, { color: colors.text }]}>
                    Estimated Cost
                  </Text>
                  <View style={styles.detailRow}>
                    <DollarSign size={16} color={colors.success} />
                    <Text style={[styles.costText, { color: colors.success }]}>
                      ${request.estimatedCost}
                    </Text>
                  </View>
                </View>
              )}

              <View style={styles.detailSection}>
                <Text style={[styles.detailTitle, { color: colors.text }]}>
                  Posted
                </Text>
                <Text
                  style={[styles.detailText, { color: colors.textSecondary }]}
                >
                  {new Date(request.createdAt).toLocaleString()}
                </Text>
              </View>
            </View>

            {/* <View style={styles.feeNotice}>
              <DollarSign size={20} color="#f59e0b" />
              <View style={styles.feeText}>
                <Text style={styles.feeTitle}>Lead Fee Information</Text>
                <Text style={styles.feeDescription}>
                  A $5 lead fee will be charged to both you and the trucker when
                  you accept this request. This ensures serious commitment from
                  both parties.
                </Text>
              </View>
            </View> */}
          </ScrollView>

          <View
            style={[
              styles.modalActions,
              {
                backgroundColor: colors.surface,
                borderTopColor: colors.border,
              },
            ]}
          >
            <TouchableOpacity
              style={[styles.cancelButton, { backgroundColor: colors.card }]}
              onPress={onClose}
            >
              <Text
                style={[
                  styles.cancelButtonText,
                  { color: colors.textSecondary },
                ]}
              >
                Close
              </Text>
            </TouchableOpacity>

            {!isTrucker && request.status === 'pending' && (
              <TouchableOpacity
                style={[
                  styles.acceptButton,
                  { backgroundColor: colors.primary },
                  isAccepting && styles.buttonDisabled,
                ]}
                onPress={() => handleAcceptRequest(request)}
                disabled={isAccepting}
              >
                {isAccepting ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.acceptButtonText}>Accept Request</Text>
                )}
              </TouchableOpacity>
            )}

            {canCancel && (
              <TouchableOpacity
                style={[
                  styles.cancelRequestButton,
                  isCancelling && styles.buttonDisabled,
                ]}
                onPress={() => handleCancelRequest(request)}
                disabled={isCancelling}
              >
                {isCancelling ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.cancelRequestButtonText}>
                    Cancel Request
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <Text style={[styles.title, { color: colors.text }]}>
          {isTrucker ? 'My Requests' : 'Available Requests'}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {isTrucker
            ? 'Track and manage your service requests'
            : 'Find and accept service requests in your area'}
        </Text>
      </View>

      <View
        style={[
          styles.filterContainer,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {filterOptions.map((filterType) => (
            <TouchableOpacity
              key={filterType}
              style={[
                styles.filterButton,
                { backgroundColor: colors.card, borderColor: colors.border },
                filter === filterType && {
                  backgroundColor: colors.primary,
                  borderColor: colors.primary,
                },
              ]}
              onPress={() => setFilter(filterType)}
            >
              <Text
                style={[
                  styles.filterText,
                  { color: colors.textSecondary },
                  filter === filterType && { color: 'white' },
                ]}
              >
                {getFilterDisplayName(filterType)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={[styles.content, { backgroundColor: colors.background }]}
      >
        {isLoadingRequests && !isTrucker ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.emptyStateText, { color: colors.text }]}>
              Loading requests
            </Text>
          </View>
        ) : filteredRequests.length === 0 ? (
          <View style={styles.emptyState}>
            <Filter size={48} color="#9ca3af" />
            <Text style={[styles.emptyStateText, { color: colors.text }]}>
              {isTrucker ? 'No requests found' : 'No requests available'}
            </Text>
            <Text
              style={[
                styles.emptyStateSubtext,
                { color: colors.textSecondary },
              ]}
            >
              {filter === 'all'
                ? isTrucker
                  ? 'Create a new request to get started'
                  : 'There are no pending requests within your service radius'
                : `No ${getFilterDisplayName(
                    filter
                  ).toLowerCase()} requests available right now`}
            </Text>
          </View>
        ) : (
          filteredRequests.map((request) => {
            const ServiceIcon = getServiceIcon(request.serviceType);
            const StatusIcon = getStatusIcon(request.status);

            return (
              <TouchableOpacity
                key={request.id}
                style={[
                  styles.requestCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => setSelectedRequest(request)}
              >
                <View style={styles.requestHeader}>
                  <View style={styles.serviceTypeContainer}>
                    <ServiceIcon size={20} color="#2563eb" />
                    <Text style={styles.serviceType}>
                      {getServiceDisplayName(request.serviceType)}
                    </Text>
                  </View>
                  <View style={styles.badgeContainer}>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusColor(request.status) },
                      ]}
                    >
                      <StatusIcon size={12} color="white" />
                      <Text style={styles.statusText}>
                        {request.status.replace('_', ' ').toUpperCase()}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.urgencyBadge,
                        { backgroundColor: getUrgencyColor(request.urgency) },
                      ]}
                    >
                      <Text style={styles.urgencyText}>{request.urgency}</Text>
                    </View>
                  </View>
                </View>

                <Text
                  style={[styles.requestDescription, { color: colors.text }]}
                  numberOfLines={2}
                >
                  {request.description}
                </Text>

                <View style={styles.requestDetails}>
                  <View style={styles.detailRow}>
                    <MapPin size={14} color={colors.textSecondary} />
                    <Text
                      style={[
                        styles.detailText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {request.location}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Phone size={14} color={colors.textSecondary} />
                    <Text
                      style={[
                        styles.detailText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {request.truckerName}
                    </Text>
                  </View>
                </View>

                <View style={styles.availableRequestFooter}>
                  {!isTrucker ? (
                    <Text
                      style={[styles.tapToAccept, { color: colors.secondary }]}
                    >
                      Tap to view & accept
                    </Text>
                  ) : (
                    <Text
                      style={[styles.tapToAccept, { color: colors.secondary }]}
                    >
                      Tap to view details
                    </Text>
                  )}
                  {request.estimatedCost && (
                    <Text
                      style={[styles.estimatedCost, { color: colors.success }]}
                    >
                      Est. ${request.estimatedCost}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <RequestDetailModal
        request={selectedRequest}
        onClose={() => setSelectedRequest(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 24,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
  },
  filterContainer: {
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  filterScroll: {
    paddingHorizontal: 24,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    padding: 24,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 280,
  },
  requestCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  serviceTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  serviceType: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  badgeContainer: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    maxWidth: '50%',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
    minWidth: 60,
    justifyContent: 'center',
  },
  statusText: {
    fontSize: 10,
    color: 'white',
    fontWeight: '500',
    textTransform: 'capitalize',
    textAlign: 'center',
    flexShrink: 1,
  },
  urgencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    minWidth: 50,
    justifyContent: 'center',
  },
  urgencyText: {
    fontSize: 10,
    textTransform: 'capitalize',
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
    flexShrink: 1,
  },
  requestDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  requestDetails: {
    gap: 4,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 12,
    paddingRight: 5,
    paddingLeft: 5,
  },
  availableRequestFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  tapToAccept: {
    fontSize: 12,
    fontWeight: '600',
  },
  estimatedCost: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingTop: 10,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
  },
  modalContent: {
    flex: 1,
    padding: 24,
  },
  requestDetailCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
  },
  serviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  serviceInfo: {
    flex: 1,
    marginLeft: 16,
  },
  serviceTypeDetail: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 8,
  },
  detailSection: {
    marginBottom: 16,
  },
  detailTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  locationContainer: {
    gap: 12,
  },
  locationButton: {
    marginTop: 8,
  },
  phoneNumber: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
  },
  costText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  feeNotice: {
    flexDirection: 'row',
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  feeText: {
    flex: 1,
    marginLeft: 12,
  },
  feeTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#92400e',
    marginBottom: 4,
  },
  feeDescription: {
    fontSize: 14,
    color: '#92400e',
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    padding: 24,
    gap: 12,
    borderTopWidth: 1,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  acceptButton: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  viewButton: {
    backgroundColor: '#2563eb20',
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  cancelRequestButton: {
    flex: 1,
    backgroundColor: '#ef4444',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  cancelRequestButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
