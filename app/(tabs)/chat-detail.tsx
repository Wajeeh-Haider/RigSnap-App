import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import { useTheme } from '@/context/ThemeContext';
import {
  ArrowLeft,
  Send,
  MapPin,
  Phone,
  Truck,
  Shield,
  Clock,
  CircleCheck as CheckCircle2,
  Star,
  X,
} from 'lucide-react-native';
import { ChatMessage } from '@/types';

export default function ChatDetailScreen() {
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const { colors } = useTheme();
  const {
    getChatMessages,
    sendMessage,
    markMessagesAsRead,
    requests,
    updateRequestStatus,
    messages: globalMessages,
  } = useApp();
  const [messageText, setMessageText] = useState('');
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const scrollViewRef = useRef<ScrollView>(null);

  const requestId = params.requestId as string;
  const request = requests.find((r) => r.id === requestId);

  // Filter messages for this specific chat from global messages
  const messages = globalMessages.filter((msg) => msg.requestId === requestId);

  useEffect(() => {
    const initializeChat = async () => {
      if (!requestId || !user?.id) return;

      // If we don't have any messages for this chat, load them specifically
      if (messages.length === 0) {
        // console.log(`🔄 Loading messages specifically for chat ${requestId}`);
        try {
          const chatMessages = await getChatMessages(requestId);
          // console.log(`📥 Loaded ${chatMessages.length} messages for current chat`);
        } catch (error) {
          console.error('Error loading chat messages:', error);
        }
      }

      // Mark messages as read when entering the chat
      await markMessagesAsRead(requestId, user.id);
      setIsLoadingMessages(false);
    };

    initializeChat();
  }, [requestId, user?.id]);

  // Auto-scroll when new messages arrive - multiple attempts for reliability
  useEffect(() => {
    if (messages.length > 0) {
      // Immediate scroll
      requestAnimationFrame(() => {
        scrollViewRef.current?.scrollToEnd({ animated: false });
      });

      // Backup scroll after short delay
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);

      // Final scroll after longer delay to ensure rendering is complete
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: false });
      }, 300);
    }
  }, [messages.length, requestId]);

  if (!user || !request) return null;

  const otherParticipant =
    user.role === 'trucker'
      ? {
          name: request.providerName || 'Service Provider',
          role: 'provider' as const,
          id: request.providerId,
        }
      : {
          name: request.truckerName,
          role: 'trucker' as const,
          id: request.truckerId,
        };

  const userLanguage = user.language || 'en';

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
          `Your device doesn't support making phone calls. The number is: ${phoneNumber}`,
          [
            {
              text: 'Copy Number',
              onPress: () => {
                // On web, we can't copy to clipboard easily, so just show the number
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

  const handleSendMessage = async () => {
    if (!messageText.trim()) return;

    const messageContent = messageText.trim();
    setMessageText(''); // Clear input immediately for better UX

    try {
      // Send message - global realtime subscription will handle adding it to UI
      await sendMessage(
        requestId,
        user.id,
        `${user.firstName} ${user.lastName}`,
        user.role,
        messageContent
      );

      // Immediate scroll after sending message
      requestAnimationFrame(() => {
        scrollViewRef.current?.scrollToEnd({ animated: false });
      });

      // Backup scroll
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Error sending message:', error);
      setMessageText(messageContent); // Restore input on error
      Alert.alert('Error', 'Failed to send message. Please try again.');
    }
  };

  const handleStatusUpdate = async (newStatus: 'in_progress' | 'completed') => {
    Alert.alert(
      'Update Status',
      `Mark this request as ${
        newStatus === 'in_progress' ? 'in progress' : 'completed'
      }?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            await updateRequestStatus(requestId, newStatus);
            sendMessage(
              requestId,
              'system',
              'System',
              user.role,
              `Request marked as ${
                newStatus === 'in_progress' ? 'in progress' : 'completed'
              }`,
              'system'
            );

            // Show completion modal for truckers when service is completed
            if (newStatus === 'completed' && user.role === 'trucker') {
              setTimeout(() => setShowCompletionModal(true), 1000);
            }
          },
        },
      ]
    );
  };

  const handleCompleteService = () => {
    if (rating === 0) {
      Alert.alert(
        'Rating Required',
        'Please provide a rating before completing the service.'
      );
      return;
    }

    // In a real app, this would update the provider's rating and save feedback
    Alert.alert(
      'Service Completed',
      `Thank you for your feedback! You rated ${
        otherParticipant.name
      } ${rating} star${rating !== 1 ? 's' : ''}.`,
      [
        {
          text: 'OK',
          onPress: () => {
            setShowCompletionModal(false);
            // Send a system message about the completion
            sendMessage(
              requestId,
              'system',
              'System',
              user.role,
              `Service completed with ${rating} star rating${
                feedback ? ': "' + feedback + '"' : ''
              }`,
              'system'
            );
          },
        },
      ]
    );
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  const MessageBubble = ({
    message,
    isOwn,
  }: {
    message: any;
    isOwn: boolean;
  }) => {
    if (message.messageType === 'system') {
      return (
        <View style={styles.systemMessage}>
          <Text style={styles.systemMessageText}>
            {message.content || message.message}
          </Text>
        </View>
      );
    }

    return (
      <View
        style={[
          styles.messageContainer,
          isOwn ? styles.ownMessage : styles.otherMessage,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isOwn ? styles.ownBubble : styles.otherBubble,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isOwn ? styles.ownMessageText : styles.otherMessageText,
            ]}
          >
            {message.content || message.message}
          </Text>

          <View style={styles.messageFooter}>
            <Text
              style={[
                styles.messageTime,
                isOwn ? styles.ownMessageTime : styles.otherMessageTime,
              ]}
            >
              {formatTime(message.timestamp)}
            </Text>
            {isOwn && (
              <CheckCircle2
                size={12}
                color={message.isRead || isOwn ? '#10b981' : '#9ca3af'}
              />
            )}
          </View>
        </View>
      </View>
    );
  };
  const StarRating = ({
    rating,
    onRatingChange,
  }: {
    rating: number;
    onRatingChange: (rating: number) => void;
  }) => {
    return (
      <View style={styles.starContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => onRatingChange(star)}
            style={styles.starButton}
          >
            <Star
              size={32}
              color={star <= rating ? '#f59e0b' : '#d1d5db'}
              fill={star <= rating ? '#f59e0b' : 'transparent'}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups: any, message) => {
    const date = formatDate(message.timestamp);
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {});

  const getKeyboardOffset = () => {
    if (Platform.OS !== 'ios') return 0;

    const osVersion = Platform.Version;
    const numericVersion =
      typeof osVersion === 'string' ? parseInt(osVersion) : osVersion;

    // iOS 26+ might need different offset
    if (numericVersion >= 26) {
      return 50; // Adjust this for iOS 26
    }

    // iOS 18-25
    if (numericVersion >= 18) {
      return 55;
    }

    return 55; // iOS 17 and below
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? getKeyboardOffset() : 20}
    >
      {/* Header */}
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

        <View style={styles.headerInfo}>
          <View style={styles.participantInfo}>
            <View
              style={[
                styles.headerLogo,
                {
                  backgroundColor:
                    otherParticipant.role === 'trucker' ? '#2563eb' : '#ea580c',
                },
              ]}
            >
              {otherParticipant.role === 'trucker' ? (
                <Truck size={16} color="white" />
              ) : (
                <Shield size={16} color="white" />
              )}
            </View>
            <View>
              <View style={styles.participantNameContainer}>
                <Text style={[styles.participantName, { color: colors.text }]}>
                  {otherParticipant.name}
                </Text>
              </View>
              <View style={styles.participantRole}>
                {otherParticipant.role === 'trucker' ? (
                  <Truck size={12} color="#2563eb" />
                ) : (
                  <Shield size={12} color="#ea580c" />
                )}
                <Text
                  style={[
                    styles.roleText,
                    {
                      color:
                        otherParticipant.role === 'trucker'
                          ? '#2563eb'
                          : '#ea580c',
                    },
                  ]}
                >
                  {otherParticipant.role === 'trucker'
                    ? 'Trucker'
                    : 'Service Provider'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.phoneButton}
            onPress={() => {
              const phoneNumber =
                user.role === 'trucker'
                  ? request.truckerPhone
                  : request.truckerPhone;
              handlePhoneCall(phoneNumber, otherParticipant.name);
            }}
          >
            <Phone size={20} color="#2563eb" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Request Info */}
      <View
        style={[
          styles.requestInfo,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <View style={styles.requestHeader}>
          <Text style={[styles.requestTitle, { color: colors.primary }]}>
            {request.serviceType.toUpperCase()} REQUEST
          </Text>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor:
                  request.status === 'completed' ? '#10b981' : '#f59e0b',
              },
            ]}
          >
            <Text style={styles.statusText}>
              {request.status.replace('_', ' ').toUpperCase()}
            </Text>
          </View>
        </View>
        <View style={styles.requestLocation}>
          <MapPin size={14} color={colors.textSecondary} />
          <Text style={[styles.locationText, { color: colors.textSecondary }]}>
            {request.location}
          </Text>
        </View>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={[
          styles.messagesContainer,
          { backgroundColor: colors.background },
        ]}
        contentContainerStyle={styles.messagesContent}
      >
        {isLoadingMessages ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Loading messages...
            </Text>
          </View>
        ) : (
          Object.entries(groupedMessages).map(
            ([date, dateMessages]: [string, any]) => (
              <View key={date}>
                <View style={styles.dateHeader}>
                  <Text style={styles.dateText}>{date}</Text>
                </View>
                {dateMessages.map((message: any, index: number) => (
                  <MessageBubble
                    key={`${message.id}-${message.timestamp}-${index}`}
                    message={message}
                    isOwn={message.senderId === user.id}
                  />
                ))}
              </View>
            )
          )
        )}
      </ScrollView>

      {/* Status Update Buttons (for providers) */}
      {user.role === 'provider' && request.status === 'accepted' && (
        <View
          style={[
            styles.statusButtons,
            { backgroundColor: colors.surface, borderTopColor: colors.border },
          ]}
        >
          <TouchableOpacity
            style={[styles.statusButton, styles.inProgressButton]}
            onPress={() => handleStatusUpdate('in_progress')}
          >
            <Clock size={16} color="white" />
            <Text style={styles.statusButtonText}>Start Work</Text>
          </TouchableOpacity>
        </View>
      )}

      {user.role === 'provider' && request.status === 'in_progress' && (
        <View
          style={[
            styles.statusButtons,
            { backgroundColor: colors.surface, borderTopColor: colors.border },
          ]}
        >
          <TouchableOpacity
            style={[styles.statusButton, styles.completeButton]}
            onPress={() => handleStatusUpdate('completed')}
          >
            <CheckCircle2 size={16} color="white" />
            <Text style={styles.statusButtonText}>Mark Complete</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Complete Service Button (for truckers when service is completed) */}
      {user.role === 'trucker' && request.status === 'completed' && (
        <View
          style={[
            styles.statusButtons,
            { backgroundColor: colors.surface, borderTopColor: colors.border },
          ]}
        >
          <TouchableOpacity
            style={[styles.statusButton, styles.rateButton]}
            onPress={() => setShowCompletionModal(true)}
          >
            <Star size={16} color="white" />
            <Text style={styles.statusButtonText}>Rate & Complete Service</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Message Input */}
      {request.status !== 'completed' && request.status !== 'cancelled' && (
        <View
          style={[
            styles.inputContainer,
            { backgroundColor: colors.surface, borderTopColor: colors.border },
          ]}
        >
          <View style={styles.inputRow}>
            <TextInput
              style={[
                styles.messageInput,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              value={messageText}
              onChangeText={setMessageText}
              placeholder="Type a message..."
              placeholderTextColor={colors.textSecondary}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                !messageText.trim() && styles.sendButtonDisabled,
              ]}
              onPress={handleSendMessage}
              disabled={!messageText.trim()}
            >
              <Send
                size={20}
                color={messageText.trim() ? 'white' : '#9ca3af'}
              />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Service Completion Modal */}
      <Modal
        visible={showCompletionModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCompletionModal(false)}
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
              onPress={() => setShowCompletionModal(false)}
              style={styles.closeButton}
            >
              <X size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={[
              styles.modalContent,
              { backgroundColor: colors.background },
            ]}
          >
            <View style={styles.providerInfo}>
              <View
                style={[styles.providerLogo, { backgroundColor: '#ea580c' }]}
              >
                <Shield size={32} color="white" />
              </View>
              <Text style={[styles.providerName, { color: colors.text }]}>
                {otherParticipant.name}
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
                { backgroundColor: colors.surface, borderColor: colors.border },
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
                  {request.serviceType.replace('_', ' ').toUpperCase()}
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
              onPress={() => setShowCompletionModal(false)}
            >
              <Text
                style={[styles.skipButtonText, { color: colors.textSecondary }]}
              >
                Skip for Now
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.completeServiceButton,
                { backgroundColor: colors.success },
                rating === 0 && styles.completeServiceButtonDisabled,
              ]}
              onPress={handleCompleteService}
              disabled={rating === 0}
            >
              <CheckCircle2 size={20} color="white" />
              <Text style={styles.completeServiceButtonText}>
                Complete Service
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 10,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  participantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  participantNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  participantRole: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  headerActions: {
    flexDirection: 'row',
  },
  phoneButton: {
    padding: 8,
    backgroundColor: '#dbeafe',
    borderRadius: 20,
  },
  requestInfo: {
    backgroundColor: 'white',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  requestTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    color: 'white',
    fontWeight: 'bold',
  },
  requestLocation: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 6,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
  },
  dateHeader: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dateText: {
    fontSize: 12,
    color: '#6b7280',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  messageContainer: {
    marginVertical: 4,
  },
  ownMessage: {
    alignItems: 'flex-end',
  },
  otherMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
  },
  ownBubble: {
    backgroundColor: '#2563eb',
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: 'white',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  ownMessageText: {
    color: 'white',
  },
  otherMessageText: {
    color: '#1e293b',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  messageTime: {
    fontSize: 11,
  },
  ownMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  otherMessageTime: {
    color: '#9ca3af',
  },
  systemMessage: {
    alignItems: 'center',
    marginVertical: 8,
  },
  systemMessageText: {
    fontSize: 14,
    color: '#6b7280',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    textAlign: 'center',
  },
  systemMessageTime: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 4,
  },
  statusButtons: {
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  statusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  inProgressButton: {
    backgroundColor: '#f59e0b',
  },
  completeButton: {
    backgroundColor: '#10b981',
  },
  rateButton: {
    backgroundColor: '#7c3aed',
  },
  statusButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  inputContainer: {
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    padding: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  messageInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#f1f5f9',
  },
  inputActions: {
    marginTop: 12,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingTop: 10,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  closeButton: {
    padding: 8,
  },
  modalContent: {
    flex: 1,
    padding: 24,
  },
  providerInfo: {
    alignItems: 'center',
    marginBottom: 32,
  },
  providerLogo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  providerName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  serviceCompleted: {
    fontSize: 16,
    color: '#10b981',
    fontWeight: '600',
  },
  ratingSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  ratingTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  ratingSubtitle: {
    fontSize: 16,
    color: '#6b7280',
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
    color: '#6b7280',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  feedbackSection: {
    marginBottom: 32,
  },
  feedbackTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 12,
  },
  feedbackInput: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  characterCount: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'right',
    marginTop: 4,
  },
  serviceDetails: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  serviceDetailsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 12,
  },
  serviceDetailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  serviceDetailLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  serviceDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    flex: 1,
    textAlign: 'right',
  },
  modalActions: {
    flexDirection: 'row',
    padding: 24,
    gap: 12,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  skipButton: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  completeServiceButton: {
    flex: 2,
    backgroundColor: '#10b981',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  completeServiceButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  completeServiceButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
});
