import { supabase } from '../lib/supabase';

export interface Chat {
  id: string;
  request_id: string;
  trucker_id: string;
  provider_id: string;
  created_at: string;
  updated_at: string;
  // Additional fields from joins
  request?: any;
  trucker?: any;
  provider?: any;
  last_message?: string;
  last_message_time?: string;
}

export interface Message {
  id: string;
  request_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'image' | 'location';
  is_read: boolean;
  timestamp: string;
  // Additional fields from joins
  sender?: any;
}

/**
 * Create a new chat in the database when a request is accepted
 */
export const createChatInDB = async (
  requestId: string,
  truckerId: string,
  providerId: string
): Promise<Chat | null> => {
  try {
    console.log('Creating chat in database:', { requestId, truckerId, providerId });

    const { data, error } = await supabase
      .from('chats')
      .insert({
        request_id: requestId,
        trucker_id: truckerId,
        provider_id: providerId
      })
      .select('*')
      .single();

    if (error) {
      console.error('Error creating chat:', error);
      return null;
    }

    console.log('Chat created successfully:', data);
    return data;
  } catch (error) {
    console.error('Exception creating chat:', error);
    return null;
  }
};

/**
 * Send a message to the database
 */
export const sendMessageToDB = async (
  requestId: string,
  senderId: string,
  content: string,
  messageType: 'text' | 'image' | 'location' = 'text'
): Promise<Message | null> => {
  try {
    console.log('Sending message to database:', { requestId, senderId, content, messageType });

    // Handle system messages - don't insert into database, return fake message
    if (senderId === 'system') {
      const fakeMessage: Message = {
        id: `system-${Date.now()}`,
        request_id: requestId,
        sender_id: senderId,
        content: content,
        message_type: messageType as any,
        is_read: true, // System messages are always "read"
        timestamp: new Date().toISOString(),
        sender: {
          id: 'system',
          name: 'System',
          role: 'system'
        }
      };
      console.log('System message created (not stored in DB):', fakeMessage);
      return fakeMessage;
    }

    const { data, error } = await supabase
      .from('messages')
      .insert({
        request_id: requestId,
        sender_id: senderId,
        content: content,
        message_type: messageType,
        is_read: false
      })
      .select('*')
      .single();

    if (error) {
      console.error('Error sending message:', error);
      return null;
    }

    // Update the chat's updated_at timestamp
    await supabase
      .from('chats')
      .update({ updated_at: new Date().toISOString() })
      .eq('request_id', requestId);

    console.log('Message sent successfully:', data);
    return data;
  } catch (error) {
    console.error('Exception sending message:', error);
    return null;
  }
};

/**
 * Subscribe to real-time messages for a specific request - OPTIMIZED FOR SPEED
 */
export const subscribeToMessages = (
  requestId: string,
  onMessageReceived: (message: any) => void,
  onMessageUpdated?: (message: any) => void
) => {
  console.log('Setting up FAST realtime subscription for request:', requestId);
  
  const subscription = supabase
    .channel(`messages:${requestId}`, {
      config: {
        broadcast: { self: false },
        presence: { key: requestId }
      }
    })
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `request_id=eq.${requestId}`,
      },
      (payload) => {
        // Process message immediately without delay
        onMessageReceived(payload.new);
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `request_id=eq.${requestId}`,
      },
      (payload) => {
        if (onMessageUpdated) {
          onMessageUpdated(payload.new);
        }
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('⚡ FAST realtime subscription active!');
      }
    });

  return subscription;
};

/**
 * Subscribe to real-time chat list updates - LIGHTNING FAST
 */
export const subscribeToChats = (
  userId: string,
  onChatCreated: (chat: any) => void,
  onChatUpdated?: (chat: any) => void
) => {
  console.log('⚡ Setting up LIGHTNING FAST chat subscription for:', userId);
  
  const subscription = supabase
    .channel(`chats:${userId}`, {
      config: {
        broadcast: { self: false },
        presence: { key: userId }
      }
    })
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chats',
        filter: `or(trucker_id.eq.${userId},provider_id.eq.${userId})`,
      },
      (payload) => {
        // Process instantly
        onChatCreated(payload.new);
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'chats',
        filter: `or(trucker_id.eq.${userId},provider_id.eq.${userId})`,
      },
      (payload) => {
        if (onChatUpdated) {
          onChatUpdated(payload.new);
        }
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('⚡ LIGHTNING FAST chat subscription active!');
      }
    });

  return subscription;
};

/**
 * Fetch all messages for a specific chat/request
 */
export const fetchChatMessages = async (requestId: string): Promise<any[]> => {
  try {
    console.log('Fetching messages for request:', requestId);

    if (!requestId || requestId === 'undefined') {
      console.error('Invalid requestId provided:', requestId);
      return [];
    }

    // First get the messages
    const { data: messagesData, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .eq('request_id', requestId)
      .order('timestamp', { ascending: true });

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      return [];
    }

    if (!messagesData || messagesData.length === 0) {
      console.log('No messages found for request');
      return [];
    }

    // For each message, fetch sender details manually and map to ChatMessage interface
    const messagesWithSender = await Promise.all(
      messagesData.map(async (message) => {
        let senderData = null;
        
        // Fetch user data for the sender
        if (message.sender_id !== null) {
          const { data } = await supabase
            .from('users')
            .select('id, name, email, role')
            .eq('id', message.sender_id)
            .single();
          senderData = data;
        }

        // Map database message to ChatMessage interface
        return {
          id: message.id,
          requestId: message.request_id,
          senderId: message.sender_id,
          senderName: senderData?.name || 'Unknown User',
          senderRole: senderData?.role || 'trucker',
          content: message.content,
          timestamp: message.timestamp || message.created_at,
          messageType: message.message_type || 'text',
          isRead: message.is_read || false,
          // Keep original fields for compatibility
          ...message,
          sender: senderData
        };
      })
    );

    console.log(`Fetched ${messagesWithSender.length} messages for request ${requestId}`);
    return messagesWithSender;
  } catch (error) {
    console.error('Exception fetching messages:', error);
    return [];
  }
};

/**
 * Fetch all chats for a specific user
 */
export const fetchUserChats = async (userId: string): Promise<Chat[]> => {
  try {
    console.log('Fetching chats for user:', userId);

    // First, get the basic chat data without joins
    const { data: chatsData, error: chatsError } = await supabase
      .from('chats')
      .select('*')
      .or(`trucker_id.eq.${userId},provider_id.eq.${userId}`)
      .order('updated_at', { ascending: false });

    if (chatsError) {
      console.error('Error fetching chats:', chatsError);
      return [];
    }

    if (!chatsData || chatsData.length === 0) {
      console.log('No chats found for user');
      return [];
    }

    // Filter out chats with invalid request_id first
    const validChatsData = chatsData.filter(chat => 
      chat.request_id && chat.request_id !== 'undefined'
    );

    if (validChatsData.length === 0) {
      console.log('No valid chats found for user');
      return [];
    }

    // For each valid chat, fetch additional data manually
    const chatsWithDetails = await Promise.all(
      validChatsData.map(async (chat) => {
        // Get request details
        const { data: requestData } = await supabase
          .from('requests')
          .select('id, title, description, service_type, location, coordinates, urgency, budget, status, created_at')
          .eq('id', chat.request_id)
          .single();

        // Get trucker details
        const { data: truckerData } = await supabase
          .from('users')
          .select('id, name, email, role')
          .eq('id', chat.trucker_id)
          .single();

        // Get service provider details
        const { data: providerData } = await supabase
          .from('users')
          .select('id, name, email, role')
          .eq('id', chat.provider_id)
          .single();

        // Get last message
        const { data: lastMessage } = await supabase
          .from('messages')
          .select('content, timestamp')
          .eq('request_id', chat.request_id)
          .order('timestamp', { ascending: false })
          .limit(1)
          .single();

        return {
          ...chat,
          // Map database fields to TypeScript interface - ensure request_id is valid
          requestId: chat.request_id,
          request_id: chat.request_id, // Keep for compatibility
          truckerId: chat.trucker_id,
          trucker_id: chat.trucker_id, // Keep for compatibility  
          providerId: chat.provider_id,
          provider_id: chat.provider_id, // Keep for compatibility
          truckerName: truckerData?.name || 'Unknown User',
          providerName: providerData?.name || 'Unknown User',
          lastMessage: lastMessage?.content || '',
          lastMessageTime: lastMessage?.timestamp || chat.updated_at,
          unreadCount: 0, // Will be calculated later
          isActive: requestData?.status !== 'completed' && requestData?.status !== 'cancelled',
          request: requestData,
          trucker: truckerData ? {
            ...truckerData,
            name: truckerData.name || 'Unknown User'
          } : { name: 'Unknown User' },
          provider: providerData ? {
            ...providerData,
            name: providerData.name || 'Unknown User'
          } : { name: 'Unknown User' },
          last_message: lastMessage?.content || '',
          last_message_time: lastMessage?.timestamp || chat.updated_at
        };
      })
    );

    console.log(`Fetched ${chatsWithDetails.length} chats for user ${userId}`);
    return chatsWithDetails;
  } catch (error) {
    console.error('Exception fetching chats:', error);
    return [];
  }
};

/**
 * Mark messages as read for a specific chat/request
 */
export const markMessagesAsRead = async (requestId: string, userId: string): Promise<boolean> => {
  try {
    console.log('Marking messages as read:', { requestId, userId });

    const { error } = await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('request_id', requestId)
      .neq('sender_id', userId)
      .eq('is_read', false);

    if (error) {
      console.error('Error marking messages as read:', error);
      return false;
    }

    console.log('Messages marked as read successfully');
    return true;
  } catch (error) {
    console.error('Exception marking messages as read:', error);
    return false;
  }
};

/**
 * Get unread message count for a user
 */
export const getUnreadMessageCount = async (userId: string): Promise<number> => {
  try {
    // Get all chats for the user
    const { data: chats, error: chatsError } = await supabase
      .from('chats')
      .select('request_id')
      .or(`trucker_id.eq.${userId},service_provider_id.eq.${userId}`)
      .eq('status', 'active');

    if (chatsError || !chats) {
      console.error('Error fetching user chats for unread count:', chatsError);
      return 0;
    }

    const requestIds = chats.map(chat => chat.request_id);
    
    if (requestIds.length === 0) {
      return 0;
    }

    // Count unread messages in these chats
    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .in('request_id', requestIds)
      .neq('sender_id', userId)
      .eq('is_read', false);

    if (error) {
      console.error('Error counting unread messages:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('Exception getting unread message count:', error);
    return 0;
  }
};

/**
 * Close a chat
 */
export const closeChatInDB = async (requestId: string): Promise<boolean> => {
  try {
    console.log('Closing chat for request:', requestId);

    // For now, we'll just update the updated_at timestamp
    // since we don't have a status column
    const { error } = await supabase
      .from('chats')
      .update({ updated_at: new Date().toISOString() })
      .eq('request_id', requestId);

    if (error) {
      console.error('Error updating chat:', error);
      return false;
    }

    console.log('Chat updated successfully');
    return true;
  } catch (error) {
    console.error('Exception updating chat:', error);
    return false;
  }
};