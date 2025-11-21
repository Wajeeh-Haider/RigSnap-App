import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from 'react';
import { Alert } from 'react-native';
import { supabase } from '@/lib/supabase';
import { ServiceRequest, Lead, ChatMessage, Chat } from '@/types';
import { useAuth } from './AuthContext';
import { requestService } from '@/utils/paymentOperations';
import { fetchAllRequests, fetchUserRequests, fetchAvailableRequests, fetchProviderRequests, updateRequestStatusInDB } from '@/utils/requestOperations';
import { 
  createChatInDB, 
  sendMessageToDB, 
  fetchChatMessages, 
  fetchUserChats, 
  markMessagesAsRead as markMessagesAsReadDB,
  subscribeToChats,
  subscribeToMessages,
  Chat as DBChat,
  Message as DBMessage
} from '@/utils/chatOperations';

interface AppContextType {
  requests: ServiceRequest[];
  leads: Lead[];
  chats: Chat[];
  messages: ChatMessage[];
  createRequest: (
    request: Omit<ServiceRequest, 'id' | 'createdAt' | 'leadFeeCharged'>
  ) => Promise<ServiceRequest>;
  acceptRequest: (
    requestId: string,
    providerId: string,
    providerName: string
  ) => Promise<boolean>;
  cancelRequest: (
    requestId: string,
    providerId: string,
    reason: string
  ) => void;
  updateRequestStatus: (
    requestId: string,
    status: ServiceRequest['status']
  ) => Promise<void>;
  addLead: (lead: Omit<Lead, 'id' | 'createdAt'>) => void;
  getUserRequests: (userId: string) => ServiceRequest[];
  getProviderRequests: (providerId: string) => ServiceRequest[];
  getAvailableRequests: () => ServiceRequest[];
  getUserChats: (userId: string) => Promise<Chat[]>;
  getChatMessages: (requestId: string) => Promise<ChatMessage[]>;
  sendMessage: (
    requestId: string,
    senderId: string,
    senderName: string,
    senderRole: 'trucker' | 'provider',
    message: string,
    messageType?: 'text' | 'location' | 'image' | 'system'
  ) => Promise<void>;
  markMessagesAsRead: (requestId: string, userId: string) => Promise<void>;
  refreshRequests: () => Promise<void>;
  isLoadingRequests: boolean;
}

const AppContext = createContext<AppContextType | null>(null);

// Mock data
const mockRequests: ServiceRequest[] = [
  {
    id: '1',
    truckerId: '1',
    truckerName: 'John Driver',
    truckerPhone: '+1-555-0123',
    serviceType: 'towing',
    description:
      'Truck broke down on I-35, need immediate towing to nearest repair shop',
    location: 'I-35 Mile Marker 234, Dallas, TX',
    coordinates: { latitude: 32.7767, longitude: -96.797 },
    status: 'pending',
    urgency: 'high',
    createdAt: '2024-01-20T10:30:00Z',
    leadFeeCharged: false,
    estimatedCost: 250,
  },
  {
    id: '2',
    truckerId: '1',
    truckerName: 'John Driver',
    truckerPhone: '+1-555-0123',
    serviceType: 'repair',
    description: 'Engine overheating, need mobile mechanic',
    location: 'Truck Stop Plaza, Houston, TX',
    coordinates: { latitude: 29.7604, longitude: -95.3698 },
    status: 'accepted',
    urgency: 'medium',
    createdAt: '2024-01-19T14:15:00Z',
    acceptedAt: '2024-01-19T14:45:00Z',
    providerId: '2',
    providerName: 'Mike Mechanic',
    leadFeeCharged: true,
    estimatedCost: 150,
  },
];

const mockLeads: Lead[] = [
  {
    id: '1',
    requestId: '2',
    userId: '1',
    userRole: 'trucker',
    amount: 5,
    status: 'charged',
    createdAt: '2024-01-19T14:45:00Z',
    description: 'Lead fee for accepted repair request',
  },
  {
    id: '2',
    requestId: '2',
    userId: '2',
    userRole: 'provider',
    amount: 5,
    status: 'charged',
    createdAt: '2024-01-19T14:45:00Z',
    description: 'Lead fee for accepting repair request',
  },
];

// Chat data will be loaded from database

export function AppProvider({ children }: { children: ReactNode }) {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [leads, setLeads] = useState<Lead[]>(mockLeads);
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [isLoadingChats, setIsLoadingChats] = useState(false);

  const { user } = useAuth();

  // Load requests and messages from database when user changes
  useEffect(() => {
    const loadInitialData = async () => {
      if (!user?.id) {
        setRequests([]);
        setMessages([]);
        return;
      }

      setIsLoadingRequests(true);
      try {
        // Load requests
        const allRequests = await fetchAllRequests();
        setRequests(allRequests);

        // Load all messages for user's chats to populate unread counts
        const userChats = await fetchUserChats(user.id);
        const allMessages: ChatMessage[] = [];
        
        for (const chat of userChats) {
          try {
            // Use request_id from database response
            const requestId = chat.request_id || chat.requestId;
            if (!requestId || requestId === 'undefined') {
              console.warn('Chat has no valid request_id:', chat);
              continue;
            }
            const chatMessages = await fetchChatMessages(requestId);
            allMessages.push(...chatMessages);
          } catch (error) {
            console.error(`Error loading messages for chat ${requestId || 'unknown'}:`, error);
          }
        }
        
        // Remove duplicates and sort by timestamp
        const uniqueMessages = allMessages.filter((message, index, self) => 
          index === self.findIndex(m => m.id === message.id)
        ).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        
        setMessages(uniqueMessages);
        console.log(`Loaded ${uniqueMessages.length} unique messages for user ${user.id}`);
      } catch (error) {
        console.error('Error loading initial data:', error);
        setRequests([]);
        setMessages([]);
      } finally {
        setIsLoadingRequests(false);
      }
    };

    loadInitialData();
  }, [user?.id]);

  // Set up realtime subscription for chats and messages
  useEffect(() => {
    if (!user?.id) return;

    let chatSubscription: any = null;
    let messageSubscription: any = null;

    // Set up realtime subscription for chat updates
    chatSubscription = subscribeToChats(
      user.id,
      // On new chat created
      (newChat) => {
        console.log('New chat created, adding to list:', newChat);
        
        // Convert DB chat to local Chat format
        const convertedChat: Chat = {
          id: newChat.id,
          requestId: newChat.request_id,
          truckerId: newChat.trucker_id,
          truckerName: 'Loading...', // Will be populated later
          providerId: newChat.provider_id,
          providerName: 'Loading...', // Will be populated later
          lastMessage: 'Chat created',
          lastMessageTime: newChat.created_at,
          unreadCount: 0,
          isActive: true,
        };

        setChats(prev => {
          // Avoid duplicates
          const exists = prev.find(chat => chat.id === newChat.id);
          if (exists) return prev;
          return [convertedChat, ...prev];
        });
      },
      // On chat updated
      (updatedChat) => {
        console.log('Chat updated via realtime:', updatedChat);
        setChats(prev => prev.map(chat => 
          chat.id === updatedChat.id 
            ? { ...chat, lastMessageTime: updatedChat.updated_at }
            : chat
        ));
      }
    );

    // Set up global realtime subscription for ALL messages
    // This keeps the chat list updated with latest messages and unread counts
    messageSubscription = supabase
      .channel('global-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const newMessage = payload.new;
          console.log('🚀 NEW MESSAGE RECEIVED GLOBALLY:', newMessage);
          
          // Convert DB message to ChatMessage format
          const convertedMessage: ChatMessage = {
            id: newMessage.id,
            requestId: newMessage.request_id,
            senderId: newMessage.sender_id,
            senderName: newMessage.sender_id === user.id ? `${user.firstName} ${user.lastName}`.trim() : 'Other User',
            content: newMessage.content,
            timestamp: newMessage.created_at,
            messageType: newMessage.message_type || 'text',
            isRead: newMessage.is_read || false
          };

          // Add to global messages array with better duplicate detection
          setMessages(prev => {
            const exists = prev.find(msg => msg.id === newMessage.id);
            if (exists) {
              console.log('⚠️ Message already exists, skipping:', newMessage.id);
              return prev;
            }
            console.log('✅ Adding new message to global state:', convertedMessage);
            // Sort messages by timestamp to maintain order
            const newMessages = [...prev, convertedMessage];
            return newMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const updatedMessage = payload.new;
          console.log('Message updated globally:', updatedMessage);
          
          // Update message in global array (for read status changes)
          setMessages(prev => prev.map(msg => 
            msg.id === updatedMessage.id 
              ? { ...msg, isRead: updatedMessage.is_read }
              : msg
          ));
        }
      )
      .subscribe((status) => {
        console.log('📡 Global message subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Global realtime message subscription is ACTIVE!');
        } else if (status === 'CLOSED') {
          console.error('❌ Global message subscription CLOSED');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Global message subscription ERROR');
        }
      });

    // Cleanup subscriptions
    return () => {
      if (chatSubscription) {
        console.log('Cleaning up chat realtime subscription');
        chatSubscription.unsubscribe();
      }
      if (messageSubscription) {
        console.log('Cleaning up global message realtime subscription');
        messageSubscription.unsubscribe();
      }
    };
  }, [user?.id]);

  // Chats are now loaded on-demand in the chat screen only

  // Function to refresh requests from database
  const refreshRequests = useCallback(async () => {
    if (!user?.id) return;
    
    setIsLoadingRequests(true);
    try {
      const allRequests = await fetchAllRequests();
      setRequests(allRequests);
    } catch (error) {
      console.error('Error refreshing requests:', error);
    } finally {
      setIsLoadingRequests(false);
    }
  }, [user?.id]);

  const createRequest = useCallback(
    async (
      requestData: Omit<ServiceRequest, 'id' | 'createdAt' | 'leadFeeCharged'>
    ) => {
      if (!user?.id) {
        throw new Error('User must be logged in to create a request');
      }

      try {
        // Use payment-enabled request creation with $5 charge
        const result = await requestService.createRequestWithPayment({
          location: requestData.location,
          coordinates: requestData.coordinates,
          service_type: requestData.serviceType,
          urgency: requestData.urgency,
          description: requestData.description,
          estimated_cost: requestData.estimatedCost,
        }, user.id);
        
        if (!result.success || !result.requestId) {
          throw new Error(result.error || 'Failed to create request');
        }

        // Create a ServiceRequest object with the data we have
        console.log('Request created with ID:', user);
        const newRequest: ServiceRequest = {
          id: result.requestId,
          truckerId: user.id,
          truckerName: `${user.firstName} ${user.lastName}`.trim() || 'Unknown',
          truckerPhone: user.phone || '',
          serviceType: requestData.serviceType,
          description: requestData.description,
          location: requestData.location,
          coordinates: requestData.coordinates,
          status: 'pending',
          urgency: requestData.urgency,
          createdAt: new Date().toISOString(),
          leadFeeCharged: true, // Payment was charged
          estimatedCost: requestData.estimatedCost,
        };
        
        // Refresh requests from database to get the latest data
        await refreshRequests();
        
        return newRequest;
      } catch (error) {
        console.error('Failed to create request with payment:', error);
        throw error;
      }
    },
    [user]
  );

  const acceptRequest = useCallback(
    async (requestId: string, providerId: string, providerName: string) => {
      try {
        console.log('🚀 Starting request acceptance:', { requestId, providerId, providerName });
        
        // Use payment-enabled request acceptance with $5 charge
        const result = await requestService.acceptRequestWithPayment(requestId, providerId);
        
        console.log('💳 Payment result:', result);
        
        if (!result.success) {
          throw new Error(result.error || 'Failed to accept request');
        }

        console.log('✅ Payment successful, waiting for database update...');
        
        // Small delay to ensure database update is committed
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Refresh requests from database to get updated data
        await refreshRequests();
        
        console.log('🔄 Requests refreshed, checking updated status...');
        
        // Log the current status of the request after refresh
        const updatedRequest = requests.find(r => r.id === requestId);
        console.log('📊 Updated request status:', updatedRequest?.status);

        // Show success alert after payment confirmation
        setTimeout(() => {
          Alert.alert(
            'Request Accepted! 🎉',
            'You have successfully accepted this request and been charged $5. The trucker has been notified and you can now start chatting.',
            [{ text: 'OK' }]
          );
        }, 100);

        const now = new Date().toISOString();
        
        // Create chat in database when request is accepted
        const request = requests.find((r) => r.id === requestId);
        if (request) {
          try {
            // Create chat in database
            const newChat = await createChatInDB(requestId, request.truckerId, providerId);
            if (newChat) {
              // Add to local state
              const convertedChat: Chat = {
                id: newChat.id,
                requestId: newChat.request_id,
                truckerId: newChat.trucker_id,
                truckerName: request.truckerName,
                providerId: newChat.provider_id,
                providerName,
                lastMessage: 'Request accepted',
                lastMessageTime: newChat.created_at,
                unreadCount: 0,
                isActive: true,
              };
              setChats((prev) => [convertedChat, ...prev]);

              // Send system message about acceptance from the provider
              const systemMessage = await sendMessageToDB(
                requestId,
                providerId,
                `${providerName} has accepted your request`,
                'text'
              );
              
              if (systemMessage) {
                const convertedMessage: ChatMessage = {
                  id: systemMessage.id,
                  requestId: systemMessage.request_id,
                  senderId: systemMessage.sender_id,
                  senderName: 'System',
                  senderRole: 'provider',
                  content: systemMessage.content,
                  timestamp: systemMessage.timestamp,
                  messageType: systemMessage.message_type as 'text' | 'location' | 'image' | 'system',
                  isRead: systemMessage.is_read,
                };
                setMessages((prev) => [...prev, convertedMessage]);
              }
            }
          } catch (error) {
            console.error('Error creating chat in database:', error);
          }
        }

        return true; // Success
      } catch (error) {
        console.error('Error accepting request:', error);
        throw error;
      }
    },
    [requests, refreshRequests]
  );

  const cancelRequest = useCallback(
    async (requestId: string, providerId: string, reason: string) => {
      const now = new Date().toISOString();
      
      // Update database first
      const result = await updateRequestStatusInDB(
        requestId, 
        'cancelled',
        {
          cancelled_at: now,
          cancellation_reason: reason,
          cancelled_by: 'provider'
        }
      );
      
      if (!result.success) {
        console.error('Failed to cancel request in database:', result.error);
        // Still update local state for better UX, but log the error
      }
      
      // Update local state
      setRequests((prev) =>
        prev.map((request) =>
          request.id === requestId
            ? {
                ...request,
                status: 'cancelled' as const,
                cancelledAt: now,
                cancellationReason: reason,
                cancelledBy: 'provider',
              }
            : request
        )
      );
    },
    [requests]
  );

  const updateRequestStatus = useCallback(
    async (requestId: string, status: ServiceRequest['status']) => {
      // Update database first
      const additionalFields: any = {};
      if (status === 'completed') {
        additionalFields.completed_at = new Date().toISOString();
      }

      const result = await updateRequestStatusInDB(requestId, status, additionalFields);
      if (!result.success) {
        console.error('Failed to update request status in DB:', result.error);
        // Still update local state for better UX, but log the error
      }

      // Update local state
      setRequests((prev) =>
        prev.map((request) =>
          request.id === requestId
            ? {
                ...request,
                status,
                ...(status === 'completed'
                  ? { completedAt: new Date().toISOString() }
                  : {}),
              }
            : request
        )
      );
    },
    []
  );

  const addLead = useCallback((leadData: Omit<Lead, 'id' | 'createdAt'>) => {
    const newLead: Lead = {
      id: Date.now().toString(),
      ...leadData,
      createdAt: new Date().toISOString(),
    };
    setLeads((prev) => [newLead, ...prev]);
  }, []);

  const getUserRequests = useCallback(
    (userId: string) => {
      return requests.filter((request) => request.truckerId === userId);
    },
    [requests]
  );

  const getProviderRequests = useCallback(
    (providerId: string) => {
      return requests.filter((request) => request.providerId === providerId);
    },
    [requests]
  );

  const getAvailableRequests = useCallback(() => {
    return requests.filter((request) => request.status === 'pending');
  }, [requests]);

  const getUserChats = useCallback(
    async (userId: string) => {
      // Return cached chats if available, otherwise fetch from database
      if (chats.length > 0) {
        return chats
          .filter(
            (chat) => chat.truckerId === userId || chat.providerId === userId
          )
          .sort(
            (a, b) =>
              new Date(b.lastMessageTime || 0).getTime() -
              new Date(a.lastMessageTime || 0).getTime()
          );
      }
      
      // Return empty array if already loading to prevent multiple simultaneous fetches
      if (isLoadingChats) {
        return [];
      }
      
      // Fetch from database if not cached
      try {
        const userChats = await fetchUserChats(userId);
        const convertedChats: Chat[] = userChats.map((dbChat) => ({
          id: dbChat.id,
          requestId: dbChat.request_id,
          truckerId: dbChat.trucker_id,
          truckerName: dbChat.trucker?.name || 'Unknown Trucker',
          providerId: dbChat.provider_id,
          providerName: dbChat.provider?.name || 'Unknown Provider',
          lastMessage: dbChat.last_message || '',
          lastMessageTime: dbChat.last_message_time || dbChat.updated_at,
          unreadCount: 0,
          isActive: true, // Assume all chats are active for now
        }));
        return convertedChats;
      } catch (error) {
        console.error('Error fetching user chats:', error);
        return [];
      }
    },
    [chats, isLoadingChats]
  );

  const getChatMessages = useCallback(
    async (requestId: string) => {
      // Check if we have messages for this request cached
      const cachedMessages = messages.filter((message) => message.requestId === requestId);
      if (cachedMessages.length > 0) {
        return cachedMessages.sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
      }
      
      // Fetch from database if not cached
      try {
        const dbMessages = await fetchChatMessages(requestId);
        const convertedMessages: ChatMessage[] = dbMessages.map((dbMessage) => ({
          id: dbMessage.id,
          requestId: dbMessage.request_id,
          senderId: dbMessage.sender_id,
          senderName: dbMessage.sender?.name || 'Unknown',
          senderRole: dbMessage.sender?.role === 'trucker' ? 'trucker' : 'provider',
          content: dbMessage.content, // Fixed: use content instead of message
          timestamp: dbMessage.timestamp,
          messageType: dbMessage.message_type as 'text' | 'location' | 'image' | 'system',
          isRead: dbMessage.is_read,
        }));
        
        // Add to messages state
        setMessages((prev) => {
          const filtered = prev.filter((m) => m.requestId !== requestId);
          return [...filtered, ...convertedMessages];
        });
        
        return convertedMessages.sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
      } catch (error) {
        console.error('Error fetching chat messages:', error);
        return [];
      }
    },
    [messages]
  );

  const sendMessage = useCallback(
    async (
      requestId: string,
      senderId: string,
      senderName: string,
      senderRole: 'trucker' | 'provider',
      message: string,
      messageType: 'text' | 'location' | 'image' | 'system' = 'text'
    ) => {
      try {
        // Send message to database - handle system messages as text type for database
        const dbMessageType = messageType === 'system' ? 'text' : messageType;
        const dbMessage = await sendMessageToDB(requestId, senderId, message, dbMessageType);
        
        if (dbMessage) {
          console.log('📤 Message sent to database successfully:', dbMessage.id);
          
          // For system messages, add to local state manually since they're not stored in DB
          if (messageType === 'system') {
            const systemMessage = {
              id: dbMessage.id,
              requestId,
              senderId,
              senderName: 'System',
              senderRole: 'system' as any,
              content: message,
              messageType,
              isRead: true,
              timestamp: dbMessage.timestamp,
            };
            setMessages((prev) => [...prev, systemMessage]);
          }
          // For regular messages, let the realtime subscription handle adding to local state

          // Update chat with new message
          setChats((prev) =>
            prev.map((chat) =>
              chat.requestId === requestId
                ? {
                    ...chat,
                    lastMessage: message,
                    lastMessageTime: dbMessage.timestamp,
                    unreadCount: senderId !== user?.id && senderId !== 'system' ? chat.unreadCount + 1 : chat.unreadCount,
                  }
                : chat
            )
          );
        }
      } catch (error) {
        console.error('Error sending message:', error);
      }
    },
    [user?.id]
  );

  const markMessagesAsRead = useCallback(
    async (requestId: string, userId: string) => {
      try {
        // Mark messages as read in database
        const success = await markMessagesAsReadDB(requestId, userId);
        
        if (success) {
          // Update local state
          setMessages((prev) =>
            prev.map((message) =>
              message.requestId === requestId &&
              message.senderId !== userId &&
              !message.isRead
                ? { ...message, isRead: true }
                : message
            )
          );

          // Reset unread count for this chat
          setChats((prev) =>
            prev.map((chat) =>
              chat.requestId === requestId
                ? {
                    ...chat,
                    unreadCount: 0,
                  }
                : chat
            )
          );
        }
      } catch (error) {
        console.error('Error marking messages as read:', error);
      }
    },
    []
  );

  return (
    <AppContext.Provider
      value={{
        requests,
        leads,
        chats,
        messages,
        createRequest,
        acceptRequest,
        cancelRequest,
        updateRequestStatus,
        addLead,
        getUserRequests,
        getProviderRequests,
        getAvailableRequests,
        getUserChats,
        getChatMessages,
        sendMessage,
        markMessagesAsRead,
        refreshRequests,
        isLoadingRequests,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
