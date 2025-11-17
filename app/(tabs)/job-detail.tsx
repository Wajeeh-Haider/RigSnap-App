import * as React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  ActivityIndicator,
  Linking,
  TextInput,
  // Image,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import { useTheme } from '@/context/ThemeContext';
import {
  ArrowLeft,
  // MapPin,
  Phone,
  Clock,
  CircleCheck as CheckCircle,
  Star,
  DollarSign,
  Calendar,
  Truck,
  Shield,
  MessageCircle,
  X,
  TriangleAlert as AlertTriangle,
  CircleCheck as CheckCircle2,
} from 'lucide-react-native';
import LocationButton from '@/components/LocationButton';
import { locationService } from '@/utils/location';
import { useState } from 'react';

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
      return AlertTriangle;
    case 'completed':
      return CheckCircle;
    case 'cancelled':
      return AlertTriangle;
    default:
      return Clock;
  }
};

const getServiceDisplayName = (serviceType: string) => {
  switch (serviceType) {
    case 'tire_repair':
      return 'Tire Repair';
    case 'truck_wash':
      return 'Truck Wash';
    case 'hose_repair':
      return 'Hose Repair';
    case 'repair':
      return 'Road Service';
    default:
      return serviceType.charAt(0).toUpperCase() + serviceType.slice(1);
  }
};

export default function JobDetailScreen() {
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const { requests, updateRequestStatus, acceptRequest, cancelRequest, refreshRequests } =
    useApp();
  const { colors } = useTheme();
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [isCompleting, setIsCompleting] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const requestId = params.requestId as string;
  const request = requests.find((r) => r.id === requestId);

  // Refresh requests when component mounts to ensure we have latest data
  React.useEffect(() => {
    refreshRequests();
  }, [requestId]);

  // Get user location on component mount
  React.useEffect(() => {
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

    getUserLocation();
  }, []);

  if (!user || !request) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.header,
            {
              backgroundColor: colors.surface,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>
            Job Not Found
          </Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.text }]}>
            Job details could not be found.
          </Text>
        </View>
      </View>
    );
  }

  const StatusIcon = getStatusIcon(request.status);
  const isTrucker = user.role === 'trucker';
  const isMyRequest = isTrucker
    ? request.truckerId === user.id
    : request.providerId === user.id;
  const canComplete = request.status === 'in_progress' && !isTrucker;
  const canRate = request.status === 'completed' && isTrucker;
  const canAccept =
    request.status === 'pending' && user.role === 'provider' && !isMyRequest;
  const canCancel =
    request.status === 'accepted' &&
    user.role === 'provider' &&
    request.providerId === user.id;

  const handlePhoneCall = async (phoneNumber: string, contactName: string) => {
    if (!phoneNumber) {
      Alert.alert(
        'No Phone Number',
        `No phone number available for ${contactName}.`
      );
      return;
    }

    // Clean the phone number (remove spaces, dashes, etc.)
    const cleanedNumber = phoneNumber.replace(/[^\d+]/g, '');
    const phoneUrl = `tel:${cleanedNumber}`;

    try {
      const supported = await Linking.canOpenURL(phoneUrl);
      if (supported) {
        await Linking.openURL(phoneUrl);
      } else {
        Alert.alert(
          'Cannot Make Call',
          `Your device doesn&apos;t support making phone calls. The number is: ${phoneNumber}`,
          [
            {
              text: 'Copy Number',
              onPress: () => {
                // On web, we can&apos;t copy to clipboard easily, so just show the number
                Alert.alert('Phone Number', phoneNumber);
              },
            },
            { text: 'OK', style: 'cancel' },
          ]
        );
      }
    } catch (error) {
      console.error('Error making phone call:', error);
      Alert.alert(
        'Call Error',
        `Unable to make the call. The number is: ${phoneNumber}`,
        [{ text: 'OK' }]
      );
    }
  };

  const handleAcceptRequest = async () => {
    setIsAccepting(true);
    try {
      acceptRequest(request.id, user.id, `${user.firstName} ${user.lastName}`);
      setShowAcceptModal(false);

      Alert.alert(
        'Request Accepted! 🎉',
        'You have successfully accepted this request. The trucker has been notified and you can now start chatting.',
        [
          {
            text: 'Start Chat',
            onPress: () => {
              router.replace({
                pathname: '/chat-detail',
                params: { requestId: request.id },
              });
            },
          },
          {
            text: 'View Job',
            style: 'cancel',
          },
        ]
      );
    } catch {
      Alert.alert('Error', 'Failed to accept request. Please try again.');
    } finally {
      setIsAccepting(false);
    }
  };

  const handleCancelRequest = async () => {
    Alert.alert(
      'Cancel Request',
      `Are you sure you want to cancel this ${getServiceDisplayName(
        request.serviceType
      ).toLowerCase()} request?\n\n⚠️ Warning: You will be charged a $5 penalty fee in addition to the original $5 lead fee (total $10). The trucker will receive a full refund.`,
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
                  onPress: async (reason:any) => {
                    if (!reason || reason.trim().length === 0) {
                      Alert.alert(
                        'Error',
                        'Please provide a reason for cancellation.'
                      );
                      return;
                    }

                    setIsCancelling(true);
                    try {
                      cancelRequest(request.id, user.id, reason.trim());
                      Alert.alert(
                        'Request Cancelled',
                        'The request has been cancelled. The trucker has been notified and will receive a full refund. You have been charged a $5 penalty fee.',
                        [{ text: 'OK', onPress: () => router.back() }]
                      );
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
  };

  const handleCompleteJob = () => {
    if (user.role !== 'provider') return;

    Alert.alert(
      'Complete Job',
      'Are you sure you want to mark this job as completed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          onPress: () => {
            updateRequestStatus(requestId, 'completed');
            Alert.alert(
              'Job Completed',
              'The job has been marked as completed. The trucker will be notified.',
              [{ text: 'OK', onPress: () => router.back() }]
            );
          },
        },
      ]
    );
  };

  const handleRateService = async () => {
    if (rating === 0) {
      Alert.alert(
        'Rating Required',
        'Please provide a rating before submitting.'
      );
      return;
    }

    setIsCompleting(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));

      setShowCompleteModal(false);
      Alert.alert(
        'Thank You!',
        `You rated this service ${rating} star${
          rating !== 1 ? 's' : ''
        }. Your feedback helps improve our platform.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch {
      Alert.alert('Error', 'Failed to submit rating. Please try again.');
    } finally {
      setIsCompleting(false);
    }
  };

  const StarRating = ({
    rating,
    onRatingChange,
    readonly = false,
  }: {
    rating: number;
    onRatingChange?: (rating: number) => void;
    readonly?: boolean;
  }) => {
    return (
      <View style={styles.starContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => !readonly && onRatingChange?.(star)}
            style={styles.starButton}
            disabled={readonly}
          >
            <Star
              size={readonly ? 16 : 32}
              color={star <= rating ? '#f59e0b' : '#d1d5db'}
              fill={star <= rating ? '#f59e0b' : 'transparent'}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };
console.log(request);
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Job Details</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        {/* Job Overview Card */}
        <View
          style={[
            styles.overviewCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.serviceHeader}>
            <View style={styles.serviceInfo}>
              <Text style={[styles.serviceType, { color: colors.primary }]}>
                {getServiceDisplayName(request.serviceType).toUpperCase()}{' '}
                SERVICE
              </Text>
              <View style={styles.statusContainer}>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(request.status) },
                  ]}
                >
                  <StatusIcon size={14} color="white" />
                  <Text style={styles.statusText}>
                    {request.status.replace('_', ' ').toUpperCase()}
                  </Text>
                </View>
                <View
                  style={[
                    styles.urgencyBadge,
                    {
                      backgroundColor:
                        request.urgency === 'high'
                          ? '#ef4444'
                          : request.urgency === 'medium'
                          ? '#f59e0b'
                          : '#10b981',
                    },
                  ]}
                >
                  <Text style={styles.urgencyText}>
                    {request.urgency.toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <Text style={[styles.description, { color: colors.text }]}>
            {request.description}
          </Text>

          {/* Photos Section */}
          {/* {request.photos && request.photos.length > 0 && (
            <View style={styles.photosSection}>
              <Text style={[styles.photosTitle, { color: colors.text }]}>
                Photos
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.photosScroll}
              >
                {request.photos.map((photo, index) => (
                  <Image
                  <Image
                    key={`photo-${index}`}
                    source={{ uri: photo }}
                    style={styles.requestPhoto}
                  />
                ))}
              </ScrollView>
            </View>
          )} */}

          <View style={styles.detailsGrid}>
            <View style={styles.detailItem}>
              <View style={styles.detailContent}>
                <Text
                  style={[styles.detailLabel, { color: colors.textSecondary }]}
                >
                  Location & Navigation
                </Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {request.location}
                </Text>

                <LocationButton
                  location={request.location}
                  coordinates={request.coordinates}
                  showDirections={!(isTrucker && isMyRequest)}
                  showEstimate={true}
                  showShare={false}
                  userLocation={userLocation || undefined}
                  style={styles.locationButton}
                  size="medium"
                  variant="primary"
                />
              </View>
            </View>

            <View style={styles.detailItem}>
              <Calendar size={18} color={colors.textSecondary} />
              <View style={styles.detailContent}>
                <Text
                  style={[styles.detailLabel, { color: colors.textSecondary }]}
                >
                  Created
                </Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {new Date(request.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            </View>

            {request.estimatedCost && (
              <View style={styles.detailItem}>
                <DollarSign size={18} color={colors.success} />
                <View style={styles.detailContent}>
                  <Text
                    style={[
                      styles.detailLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Estimated Cost
                  </Text>
                  <Text style={[styles.detailValue, { color: colors.success }]}>
                    ${request.estimatedCost}
                  </Text>
                </View>
              </View>
            )}

            {request.acceptedAt && (
              <View style={styles.detailItem}>
                <CheckCircle size={18} color={colors.success} />
                <View style={styles.detailContent}>
                  <Text
                    style={[
                      styles.detailLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Accepted
                  </Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {new Date(request.acceptedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              </View>
            )}

            {request.cancelledAt && (
              <View style={styles.detailItem}>
                <AlertTriangle size={18} color={colors.error} />
                <View style={styles.detailContent}>
                  <Text
                    style={[
                      styles.detailLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Cancelled
                  </Text>
                  <Text style={[styles.detailValue, { color: colors.error }]}>
                    {new Date(request.cancelledAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                  {request.cancellationReason && (
                    <Text
                      style={[
                        styles.cancellationReason,
                        { color: colors.error },
                      ]}
                    >
                      Reason: {request.cancellationReason}
                    </Text>
                  )}
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Participants Card */}
        <View
          style={[
            styles.participantsCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Participants
          </Text>

          {/* Trucker Info */}
          <View style={styles.participantItem}>
            <View style={styles.participantHeader}>
              <View
                style={[styles.participantLogo, { backgroundColor: '#2563eb' }]}
              >
                <Truck size={20} color="white" />
              </View>
              <View style={styles.participantInfo}>
                <Text style={[styles.participantName, { color: colors.text }]}>
                  {request.truckerName}
                </Text>
                <View style={styles.participantRole}>
                  <Truck size={14} color="#2563eb" />
                  <Text
                    style={[styles.roleText, { color: colors.textSecondary }]}
                  >
                    Trucker
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={[
                  styles.contactButton,
                  { backgroundColor: colors.primary + '20' },
                ]}
                onPress={() =>
                  handlePhoneCall(request.truckerPhone, request.truckerName)
                }
              >
                <Phone size={16} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Provider Info */}
          {request.providerName && (
            <View style={styles.participantItem}>
              <View style={styles.participantHeader}>
                <View
                  style={[
                    styles.participantLogo,
                    { backgroundColor: '#ea580c' },
                  ]}
                >
                  <Shield size={20} color="white" />
                </View>
                <View style={styles.participantInfo}>
                  <Text
                    style={[styles.participantName, { color: colors.text }]}
                  >
                    {request.providerName}
                  </Text>
                  <View style={styles.participantRole}>
                    <Shield size={14} color="#ea580c" />
                    <Text
                      style={[styles.roleText, { color: colors.textSecondary }]}
                    >
                      Service Provider
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[
                    styles.contactButton,
                    { backgroundColor: colors.secondary + '20' },
                  ]}
                  onPress={() =>
                    handlePhoneCall(
                      request.truckerPhone,
                      request.providerName || 'Service Provider'
                    )
                  }
                >
                  <Phone size={16} color={colors.secondary} />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Timeline Card */}
        <View
          style={[
            styles.timelineCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Timeline
          </Text>

          <View style={styles.timelineItem}>
            <View
              style={[styles.timelineDot, { backgroundColor: '#2563eb' }]}
            />
            <View style={styles.timelineContent}>
              <Text style={[styles.timelineTitle, { color: colors.text }]}>
                Request Created
              </Text>
              <Text
                style={[styles.timelineTime, { color: colors.textSecondary }]}
              >
                {new Date(request.createdAt).toLocaleString()}
              </Text>
            </View>
          </View>

          {request.acceptedAt && (
            <View style={styles.timelineItem}>
              <View
                style={[styles.timelineDot, { backgroundColor: '#10b981' }]}
              />
              <View style={styles.timelineContent}>
                <Text style={[styles.timelineTitle, { color: colors.text }]}>
                  Request Accepted
                </Text>
                <Text
                  style={[styles.timelineTime, { color: colors.textSecondary }]}
                >
                  {new Date(request.acceptedAt).toLocaleString()}
                </Text>
                <Text
                  style={[
                    styles.timelineDescription,
                    { color: colors.textSecondary },
                  ]}
                >
                  Accepted by {request.providerName}
                </Text>
              </View>
            </View>
          )}

          {request.status === 'in_progress' && (
            <View style={styles.timelineItem}>
              <View
                style={[styles.timelineDot, { backgroundColor: '#8b5cf6' }]}
              />
              <View style={styles.timelineContent}>
                <Text style={[styles.timelineTitle, { color: colors.text }]}>
                  Work in Progress
                </Text>
                <Text
                  style={[
                    styles.timelineDescription,
                    { color: colors.textSecondary },
                  ]}
                >
                  Service provider is working on your request
                </Text>
              </View>
            </View>
          )}

          {request.completedAt && (
            <View style={styles.timelineItem}>
              <View
                style={[styles.timelineDot, { backgroundColor: '#059669' }]}
              />
              <View style={styles.timelineContent}>
                <Text style={[styles.timelineTitle, { color: colors.text }]}>
                  Job Completed
                </Text>
                <Text
                  style={[styles.timelineTime, { color: colors.textSecondary }]}
                >
                  {new Date(request.completedAt).toLocaleString()}
                </Text>
              </View>
            </View>
          )}

          {request.cancelledAt && (
            <View style={styles.timelineItem}>
              <View
                style={[styles.timelineDot, { backgroundColor: '#ef4444' }]}
              />
              <View style={styles.timelineContent}>
                <Text style={[styles.timelineTitle, { color: colors.text }]}>
                  Request Cancelled
                </Text>
                <Text
                  style={[styles.timelineTime, { color: colors.textSecondary }]}
                >
                  {new Date(request.cancelledAt).toLocaleString()}
                </Text>
                <Text
                  style={[
                    styles.timelineDescription,
                    { color: colors.textSecondary },
                  ]}
                >
                  Cancelled by{' '}
                  {request.cancelledBy === 'provider'
                    ? 'service provider'
                    : 'trucker'}
                </Text>
                {request.cancellationReason && (
                  <Text
                    style={[
                      styles.timelineDescription,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Reason: {request.cancellationReason}
                  </Text>
                )}
              </View>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          {/* Accept Request Button for Providers */}
          {canAccept && (
            <TouchableOpacity
              style={styles.acceptButton}
              onPress={() => setShowAcceptModal(true)}
            >
              <CheckCircle2 size={20} color="white" />
              <Text style={styles.acceptButtonText}>Accept Request</Text>
            </TouchableOpacity>
          )}

          {/* Cancel Request Button for Providers */}
          {canCancel && (
            <TouchableOpacity
              style={[
                styles.cancelRequestButton,
                isCancelling && styles.cancelRequestButtonDisabled,
              ]}
              onPress={handleCancelRequest}
              disabled={isCancelling}
            >
              {isCancelling ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <>
                  <X size={20} color="white" />
                  <Text style={styles.cancelRequestButtonText}>
                    Cancel Request
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Chat Button */}
          {request.status !== 'pending' &&
            request.status !== 'cancelled' &&
            request.providerId && (
              <TouchableOpacity
                style={styles.chatButton}
                onPress={() =>
                  router.push({
                    pathname: '/chat-detail',
                    params: { requestId: request.id },
                  })
                }
              >
                <MessageCircle size={20} color="white" />
                <Text style={styles.chatButtonText}>Open Chat</Text>
              </TouchableOpacity>
            )}

          {/* Complete Job Button for Providers */}
          {canComplete && (
            <TouchableOpacity
              style={styles.completeButton}
              onPress={handleCompleteJob}
            >
              <CheckCircle size={20} color="white" />
              <Text style={styles.completeButtonText}>Mark as Complete</Text>
            </TouchableOpacity>
          )}

          {/* Rate Service Button for Truckers */}
          {canRate && (
            <TouchableOpacity
              style={styles.rateButton}
              onPress={() => setShowCompleteModal(true)}
            >
              <Star size={20} color="white" />
              <Text style={styles.rateButtonText}>Rate Service</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Accept Request Modal */}
      <Modal
        visible={showAcceptModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAcceptModal(false)}
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
              Accept Request
            </Text>
            <TouchableOpacity
              onPress={() => setShowAcceptModal(false)}
              style={styles.closeButton}
            >
              <X size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.acceptModalContent}>
              <View style={styles.acceptIcon}>
                <CheckCircle2 size={48} color={colors.success} />
              </View>

              <Text style={[styles.acceptTitle, { color: colors.text }]}>
                Accept This Request?
              </Text>
              <Text
                style={[styles.acceptSubtitle, { color: colors.textSecondary }]}
              >
                You are about to accept a{' '}
                {getServiceDisplayName(request.serviceType).toLowerCase()}{' '}
                request from {request.truckerName}re about to accept a{' '}
                {getServiceDisplayName(request.serviceType).toLowerCase()}{' '}
                request from {request.truckerName}
              </Text>

              <View
                style={[
                  styles.requestSummary,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View style={styles.summaryItem}>
                  <Text
                    style={[
                      styles.summaryLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Service Type:
                  </Text>
                  <Text style={[styles.summaryValue, { color: colors.text }]}>
                    {getServiceDisplayName(request.serviceType)}
                  </Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text
                    style={[
                      styles.summaryLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Location:
                  </Text>
                  <Text style={[styles.summaryValue, { color: colors.text }]}>
                    {request.location}
                  </Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text
                    style={[
                      styles.summaryLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Urgency:
                  </Text>
                  <Text
                    style={[
                      styles.summaryValue,
                      {
                        color:
                          request.urgency === 'high'
                            ? '#ef4444'
                            : request.urgency === 'medium'
                            ? '#f59e0b'
                            : '#10b981',
                        fontWeight: 'bold',
                      },
                    ]}
                  >
                    {request.urgency.toUpperCase()}
                  </Text>
                </View>
                {request.estimatedCost && (
                  <View style={styles.summaryItem}>
                    <Text
                      style={[
                        styles.summaryLabel,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Estimated Cost:
                    </Text>
                    <Text
                      style={[
                        styles.summaryValue,
                        { color: colors.success, fontWeight: 'bold' },
                      ]}
                    >
                      ${request.estimatedCost}
                    </Text>
                  </View>
                )}
              </View>

              <View
                style={[
                  styles.feeNotice,
                  {
                    backgroundColor: colors.warning + '20',
                    borderColor: colors.warning + '40',
                  },
                ]}
              >
                <DollarSign size={20} color={colors.warning} />
                <View style={styles.feeText}>
                  <Text style={[styles.feeTitle, { color: colors.warning }]}>
                    Lead Fee Notice
                  </Text>
                  <Text
                    style={[styles.feeDescription, { color: colors.warning }]}
                  >
                    A $5 lead fee will be charged to both you and the trucker
                    when you accept this request. This ensures serious
                    commitment from both parties.
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.benefitsSection,
                  {
                    backgroundColor: colors.success + '20',
                    borderColor: colors.success + '40',
                  },
                ]}
              >
                <Text style={[styles.benefitsTitle, { color: colors.success }]}>
                  What happens next:
                </Text>
                <View style={styles.benefitItem}>
                  <CheckCircle2 size={16} color={colors.success} />
                  <Text style={[styles.benefitText, { color: colors.success }]}>
                    You&apos;ll be connected with the trucker via chat
                  </Text>
                </View>
                <View style={styles.benefitItem}>
                  <CheckCircle2 size={16} color={colors.success} />
                  <Text style={[styles.benefitText, { color: colors.success }]}>
                    You can coordinate location and service details
                  </Text>
                </View>
                <View style={styles.benefitItem}>
                  <CheckCircle2 size={16} color={colors.success} />
                  <Text style={[styles.benefitText, { color: colors.success }]}>
                    Get paid directly by the trucker for your services
                  </Text>
                </View>
              </View>
            </View>
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
              onPress={() => setShowAcceptModal(false)}
            >
              <Text
                style={[
                  styles.cancelButtonText,
                  { color: colors.textSecondary },
                ]}
              >
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.confirmAcceptButton,
                { backgroundColor: colors.success },
                isAccepting && styles.confirmAcceptButtonDisabled,
              ]}
              onPress={handleAcceptRequest}
              disabled={isAccepting}
            >
              {isAccepting ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <>
                  <CheckCircle2 size={16} color="white" />
                  <Text style={styles.confirmAcceptButtonText}>
                    Accept Request
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Rating Modal */}
      <Modal
        visible={showCompleteModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCompleteModal(false)}
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
              Rate Your Experience
            </Text>
            <TouchableOpacity
              onPress={() => setShowCompleteModal(false)}
              style={styles.closeButton}
            >
              <X size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.providerInfo}>
              <View
                style={[styles.providerLogo, { backgroundColor: '#ea580c' }]}
              >
                <Shield size={32} color="white" />
              </View>
              <Text style={[styles.providerName, { color: colors.text }]}>
                {request.providerName}
              </Text>
              <Text
                style={[styles.serviceCompleted, { color: colors.success }]}
              >
                Service Completed Successfully!
              </Text>
            </View>

            <View style={styles.ratingSection}>
              <Text style={[styles.ratingTitle, { color: colors.text }]}>
                How was your experience?
              </Text>
              <Text
                style={[styles.ratingSubtitle, { color: colors.textSecondary }]}
              >
                Rate the service provider
              </Text>

              <StarRating rating={rating} onRatingChange={setRating} />

              {rating > 0 && (
                <Text
                  style={[styles.ratingText, { color: colors.textSecondary }]}
                >
                  {rating === 1 && 'Poor - Service needs improvement'}
                  {rating === 2 && 'Fair - Service was below expectations'}
                  {rating === 3 && 'Good - Service met expectations'}
                  {rating === 4 && 'Very Good - Service exceeded expectations'}
                  {rating === 5 && 'Excellent - Outstanding service!'}
                </Text>
              )}
            </View>

            <View style={styles.feedbackSection}>
              <Text style={[styles.feedbackTitle, { color: colors.text }]}>
                Additional Feedback (Optional)
              </Text>
              <TextInput
                style={[
                  styles.feedbackInput,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                value={feedback}
                onChangeText={setFeedback}
                placeholder="Share your experience to help other truckers..."
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={300}
              />
              <Text
                style={[styles.characterCount, { color: colors.textSecondary }]}
              >
                {feedback.length}/300
              </Text>
            </View>

            <View
              style={[
                styles.serviceDetails,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text
                style={[styles.serviceDetailsTitle, { color: colors.text }]}
              >
                Service Summary
              </Text>
              <View style={styles.serviceDetailItem}>
                <Text
                  style={[
                    styles.serviceDetailLabel,
                    { color: colors.textSecondary },
                  ]}
                >
                  Service Type:
                </Text>
                <Text
                  style={[styles.serviceDetailValue, { color: colors.text }]}
                >
                  {getServiceDisplayName(request.serviceType)}
                </Text>
              </View>
              <View style={styles.serviceDetailItem}>
                <Text
                  style={[
                    styles.serviceDetailLabel,
                    { color: colors.textSecondary },
                  ]}
                >
                  Location:
                </Text>
                <Text
                  style={[styles.serviceDetailValue, { color: colors.text }]}
                >
                  {request.location}
                </Text>
              </View>
              {request.estimatedCost && (
                <View style={styles.serviceDetailItem}>
                  <Text
                    style={[
                      styles.serviceDetailLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Estimated Cost:
                  </Text>
                  <Text
                    style={[styles.serviceDetailValue, { color: colors.text }]}
                  >
                    ${request.estimatedCost}
                  </Text>
                </View>
              )}
            </View>
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
              style={[styles.skipButton, { backgroundColor: colors.card }]}
              onPress={() => setShowCompleteModal(false)}
            >
              <Text
                style={[styles.skipButtonText, { color: colors.textSecondary }]}
              >
                Skip for Now
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.submitRatingButton,
                { backgroundColor: colors.success },
                (rating === 0 || isCompleting) &&
                  styles.submitRatingButtonDisabled,
              ]}
              onPress={handleRateService}
              disabled={rating === 0 || isCompleting}
            >
              {isCompleting ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <>
                  <Star size={16} color="white" />
                  <Text style={styles.submitRatingButtonText}>
                    Submit Rating
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
    paddingTop: 10,
    borderBottomWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
  },
  overviewCard: {
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  serviceHeader: {
    marginBottom: 20,
  },
  serviceInfo: {
    gap: 12,
  },
  serviceType: {
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  statusContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  urgencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  urgencyText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 20,
  },
  photosSection: {
    marginBottom: 20,
  },
  photosTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  photosScroll: {
    marginHorizontal: -24,
    paddingHorizontal: 24,
  },
  requestPhoto: {
    width: 120,
    height: 120,
    borderRadius: 8,
    marginRight: 12,
  },
  detailsGrid: {
    gap: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  locationButton: {
    marginTop: 8,
  },
  cancellationReason: {
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  participantsCard: {
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  participantItem: {
    marginBottom: 16,
  },
  participantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  participantLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  participantRole: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '500',
  },
  contactButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineCard: {
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  timelineTime: {
    fontSize: 12,
    marginBottom: 2,
  },
  timelineDescription: {
    fontSize: 12,
  },
  actionsContainer: {
    gap: 12,
    marginBottom: 24,
  },
  acceptButton: {
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  acceptButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelRequestButton: {
    backgroundColor: '#ef4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  cancelRequestButtonDisabled: {
    opacity: 0.6,
  },
  cancelRequestButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  chatButton: {
    backgroundColor: '#3b82f6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  chatButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  completeButton: {
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  completeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  rateButton: {
    backgroundColor: '#f59e0b',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  rateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  acceptModalContent: {
    alignItems: 'center',
  },
  acceptIcon: {
    marginBottom: 24,
  },
  acceptTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  acceptSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  requestSummary: {
    width: '100%',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  feeNotice: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
    gap: 12,
  },
  feeText: {
    flex: 1,
  },
  feeTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  feeDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  benefitsSection: {
    width: '100%',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  benefitsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  benefitText: {
    fontSize: 12,
    flex: 1,
  },
  modalActions: {
    flexDirection: 'row',
    padding: 24,
    gap: 12,
    borderTopWidth: 1,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  confirmAcceptButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  confirmAcceptButtonDisabled: {
    opacity: 0.6,
  },
  confirmAcceptButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  providerInfo: {
    alignItems: 'center',
    marginBottom: 32,
  },
  providerLogo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  providerName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  serviceCompleted: {
    fontSize: 16,
    fontWeight: '600',
  },
  ratingSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  ratingTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  ratingSubtitle: {
    fontSize: 14,
    marginBottom: 24,
  },
  starContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  starButton: {
    padding: 4,
  },
  ratingText: {
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  feedbackSection: {
    marginBottom: 24,
  },
  feedbackTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  feedbackInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
    minHeight: 100,
    marginBottom: 8,
  },
  characterCount: {
    fontSize: 12,
    textAlign: 'right',
  },
  serviceDetails: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  serviceDetailsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  serviceDetailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  serviceDetailLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  serviceDetailValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  skipButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  submitRatingButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  submitRatingButtonDisabled: {
    opacity: 0.6,
  },
  submitRatingButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
