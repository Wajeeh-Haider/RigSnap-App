import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { ServiceRequest, Lead, ChatMessage, Chat } from '@/types';
import { useAuth } from './AuthContext';

interface AppContextType {
  requests: ServiceRequest[];
  leads: Lead[];
  chats: Chat[];
  messages: ChatMessage[];
  createRequest: (request: Omit<ServiceRequest, 'id' | 'createdAt' | 'leadFeeCharged'>) => void;
  acceptRequest: (requestId: string, providerId: string, providerName: string) => void;
  cancelRequest: (requestId: string, providerId: string, reason: string) => void;
  updateRequestStatus: (requestId: string, status: ServiceRequest['status']) => void;
  addLead: (lead: Omit<Lead, 'id' | 'createdAt'>) => void;
  getUserRequests: (userId: string) => ServiceRequest[];
  getProviderRequests: (providerId: string) => ServiceRequest[];
  getAvailableRequests: () => ServiceRequest[];
  getUserChats: (userId: string) => Chat[];
  getChatMessages: (requestId: string) => ChatMessage[];
  sendMessage: (requestId: string, senderId: string, senderName: string, senderRole: 'trucker' | 'provider', message: string, messageType?: 'text' | 'location' | 'image' | 'system') => void;
  markMessagesAsRead: (requestId: string, userId: string) => void;
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
    description: 'Truck broke down on I-35, need immediate towing to nearest repair shop',
    location: 'I-35 Mile Marker 234, Dallas, TX',
    coordinates: { latitude: 32.7767, longitude: -96.7970 },
    status: 'pending',
    urgency: 'high',
    createdAt: '2024-01-20T10:30:00Z',
    leadFeeCharged: false,
    estimatedCost: 250
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
    estimatedCost: 150
  }
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
    description: 'Lead fee for accepted repair request'
  },
  {
    id: '2',
    requestId: '2',
    userId: '2',
    userRole: 'provider',
    amount: 5,
    status: 'charged',
    createdAt: '2024-01-19T14:45:00Z',
    description: 'Lead fee for accepting repair request'
  }
];

const mockChats: Chat[] = [
  {
    id: '1',
    requestId: '2',
    truckerId: '1',
    truckerName: 'John Driver',
    providerId: '2',
    providerName: 'Mike Mechanic',
    lastMessage: 'I\'ll be there in 20 minutes',
    lastMessageTime: '2024-01-19T15:30:00Z',
    unreadCount: 2,
    isActive: true
  }
];

const mockMessages: ChatMessage[] = [
  {
    id: '1',
    requestId: '2',
    senderId: '2',
    senderName: 'Mike Mechanic',
    senderRole: 'provider',
    message: 'Hi John, I\'ve accepted your repair request. I\'m currently 15 minutes away from your location.',
    timestamp: '2024-01-19T14:50:00Z',
    messageType: 'text',
    isRead: true
  },
  {
    id: '2',
    requestId: '2',
    senderId: '1',
    senderName: 'John Driver',
    senderRole: 'trucker',
    message: 'Great! I\'m parked at the truck stop. My truck is a blue Peterbilt.',
    timestamp: '2024-01-19T14:52:00Z',
    messageType: 'text',
    isRead: true
  },
  {
    id: '3',
    requestId: '2',
    senderId: '2',
    senderName: 'Mike Mechanic',
    senderRole: 'provider',
    message: 'Perfect, I can see it. I\'ll be there in 20 minutes. Do you have the engine codes?',
    timestamp: '2024-01-19T15:30:00Z',
    messageType: 'text',
    isRead: true
  },
  {
    id: '4',
    requestId: '2',
    senderId: 'system',
    senderName: 'System',
    senderRole: 'provider',
    message: 'Mike Mechanic has accepted your request',
    timestamp: '2024-01-19T14:45:00Z',
    messageType: 'system',
    isRead: true
  }
];

export function AppProvider({ children }: { children: ReactNode }) {
  const [requests, setRequests] = useState<ServiceRequest[]>(mockRequests);
  const [leads, setLeads] = useState<Lead[]>(mockLeads);
  const [chats, setChats] = useState<Chat[]>(mockChats);
  const [messages, setMessages] = useState<ChatMessage[]>(mockMessages);

  const { user } = useAuth();

  const createRequest = useCallback((requestData: Omit<ServiceRequest, 'id' | 'createdAt' | 'leadFeeCharged'>) => {
    const newRequest: ServiceRequest = {
      id: Date.now().toString(),
      ...requestData,
      createdAt: new Date().toISOString(),
      leadFeeCharged: false,
    };
    setRequests(prev => [newRequest, ...prev]);
  }, [user]);

  const acceptRequest = useCallback((requestId: string, providerId: string, providerName: string) => {
    const now = new Date().toISOString();
    setRequests(prev => prev.map(request => 
      request.id === requestId 
        ? { 
            ...request, 
            status: 'accepted' as const,
            providerId,
            providerName,
            acceptedAt: now,
            leadFeeCharged: true
          }
        : request
    ));
    
    // Create or update chat when request is accepted
    const request = requests.find(r => r.id === requestId);
    if (request) {
      const existingChat = chats.find(c => c.requestId === requestId);
      if (!existingChat) {
        const newChat: Chat = {
          id: Date.now().toString(),
          requestId,
          truckerId: request.truckerId,
          truckerName: request.truckerName,
          providerId,
          providerName,
          lastMessage: 'Request accepted',
          lastMessageTime: now,
          unreadCount: 0, // Will be calculated from actual messages
          isActive: true
        };
        setChats(prev => [newChat, ...prev]);
        
        // Send system message about acceptance
        const systemMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          requestId,
          senderId: 'system',
          senderName: 'System',
          senderRole: 'provider',
          message: `${providerName} has accepted your request`,
          timestamp: now,
          messageType: 'system',
          isRead: false,
        };
        setMessages(prev => [...prev, systemMessage]);
      }
    }
  }, [requests]);

  const cancelRequest = useCallback((requestId: string, providerId: string, reason: string) => {
    const now = new Date().toISOString();
    setRequests(prev => prev.map(request => 
      request.id === requestId 
        ? { 
            ...request, 
            status: 'cancelled' as const,
            cancelledAt: now,
            cancellationReason: reason,
            cancelledBy: 'provider'
          }
        : request
    ));
  }, [requests]);

  const updateRequestStatus = useCallback((requestId: string, status: ServiceRequest['status']) => {
    setRequests(prev => prev.map(request => 
      request.id === requestId 
        ? { 
            ...request, 
            status,
            ...(status === 'completed' ? { completedAt: new Date().toISOString() } : {})
          }
        : request
    ));
  }, []);

  const addLead = useCallback((leadData: Omit<Lead, 'id' | 'createdAt'>) => {
    const newLead: Lead = {
      id: Date.now().toString(),
      ...leadData,
      createdAt: new Date().toISOString(),
    };
    setLeads(prev => [newLead, ...prev]);
  }, []);

  const getUserRequests = useCallback((userId: string) => {
    return requests.filter(request => request.truckerId === userId);
  }, [requests]);

  const getProviderRequests = useCallback((providerId: string) => {
    return requests.filter(request => request.providerId === providerId);
  }, [requests]);

  const getAvailableRequests = useCallback(() => {
    return requests.filter(request => request.status === 'pending');
  }, [requests]);

  const getUserChats = useCallback((userId: string) => {
    return chats.filter(chat => 
      chat.truckerId === userId || chat.providerId === userId
    ).sort((a, b) => 
      new Date(b.lastMessageTime || 0).getTime() - new Date(a.lastMessageTime || 0).getTime()
    );
  }, [chats]);

  const getChatMessages = useCallback((requestId: string) => {
    return messages
      .filter(message => message.requestId === requestId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [messages]);

  const sendMessage = useCallback((
    requestId: string, 
    senderId: string, 
    senderName: string, 
    senderRole: 'trucker' | 'provider', 
    message: string,
    messageType: 'text' | 'location' | 'image' | 'system' = 'text'
  ) => {
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      requestId,
      senderId,
      senderName,
      senderRole,
      message,
      timestamp: new Date().toISOString(),
      messageType,
      isRead: false, // All messages start as unread
    };
    setMessages(prev => [...prev, newMessage]);
    
    // Update chat with new message
    setChats(prev => prev.map(chat => 
      chat.requestId === requestId 
        ? { 
            ...chat, 
            lastMessage: message,
            lastMessageTime: new Date().toISOString(),
            // Increment unread count for all new messages (will be handled when marking as read)
            unreadCount: chat.unreadCount + 1
          }
        : chat
    ));
  }, [user?.id]);

  const markMessagesAsRead = useCallback((requestId: string, userId: string) => {
    // Mark all unread messages in this conversation as read (except own messages)
    setMessages(prev => prev.map(message =>
      message.requestId === requestId && message.senderId !== userId && !message.isRead
        ? { ...message, isRead: true }
        : message
    ));
    
    // Reset unread count for this chat (only count messages from others)
    setChats(prev => prev.map(chat =>
      chat.requestId === requestId
        ? { 
            ...chat, 
            unreadCount: messages.filter(m => 
              m.requestId === requestId && 
              m.senderId !== userId && 
              m.isRead === false
            ).length 
          }
        : chat
    ));
  }, []);

  return (
    <AppContext.Provider value={{
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
      markMessagesAsRead
    }}>
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