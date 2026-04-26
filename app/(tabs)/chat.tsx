import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import { MessageCircle, Truck, Shield, Search, ChevronRight } from 'lucide-react-native';
import { Chat } from '@/types';

export default function ChatListScreen() {
  const { user } = useAuth();
  const { getUserChats, messages } = useApp();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [userChats, setUserChats] = useState<Chat[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadChats = async () => {
      if (!user?.id) return;
      
      setIsLoading(true);
      try {
        const chats = await getUserChats(user.id);
        setUserChats(chats);
      } catch (error) {
        console.error('Error loading chats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadChats();
  }, [user?.id]); // Remove getUserChats from dependencies

  // Refresh chat list when messages change to update last message display
  useEffect(() => {
    const refreshChats = async () => {
      if (!user?.id || userChats.length === 0) return;
      
      try {
        const updatedChats = await getUserChats(user.id);
        // Filter out chats with invalid requestId
        const validChats = updatedChats.filter(chat => {
          return chat.requestId && chat.requestId !== 'undefined';
        });
        setUserChats(validChats);
      } catch (error) {
        console.error('Error refreshing chats:', error);
      }
    };

    // Debounce the refresh to avoid too many calls
    const timeoutId = setTimeout(refreshChats, 500);
    return () => clearTimeout(timeoutId);
  }, [messages.length, user?.id]); // Refresh when message count changes

  if (!user) return null;

  // Calculate unread count from actual messages (only from other users)
  const totalUnreadCount = messages.filter(
    (message) =>
      message.senderId !== user.id &&
      !message.isRead &&
      userChats.some((chat) => chat.requestId === message.requestId)
  ).length;

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return 'Now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getOtherParticipant = (chat: any) => {
    if (user.role === 'trucker') {
      return {
        name: chat.providerName,
        role: 'provider' as const,
        icon: Shield,
      };
    } else {
      return {
        name: chat.truckerName,
        role: 'trucker' as const,
        icon: Truck,
      };
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.headerWrap}>
        <View
          style={[
            styles.headerCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.headerTopRow}>
            <Text style={[styles.title, { color: colors.text }]}>
              {t('chat.title')}
            </Text>
            {totalUnreadCount > 0 && (
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>
                  {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                </Text>
              </View>
            )}
          </View>

          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {user.role === 'trucker'
              ? t('chat.messagesWillAppear')
              : t('chat.messagesWillAppearProvider')}
          </Text>

          <View
            style={[
              styles.searchHint,
              { backgroundColor: colors.background, borderColor: colors.border },
            ]}
          >
            <Search size={14} color={colors.textSecondary} />
            <Text style={[styles.searchHintText, { color: colors.textSecondary }]}>
              Latest conversations
            </Text>
          </View>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            Loading chats...
          </Text>
        </View>
      ) : userChats.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MessageCircle size={48} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {t('chat.noMessagesYet')}
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            {user.role === 'trucker'
              ? t('chat.messagesWillAppear')
              : t('chat.messagesWillAppearProvider')}
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {userChats.map((chat) => {
            const otherParticipant = getOtherParticipant(chat);
            const ParticipantIcon = otherParticipant.icon;

            // Calculate actual unread count for this chat from messages
            const chatUnreadCount = messages.filter(
              (message) =>
                message.requestId === chat.requestId &&
                message.senderId !== user.id &&
                !message.isRead
            ).length;
            const hasUnread = chatUnreadCount > 0;

            return (
              <TouchableOpacity
                key={chat.id}
                style={[
                  styles.chatCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                  hasUnread && styles.chatCardUnread,
                ]}
                onPress={() =>
                  router.push({
                    pathname: '/chat-detail',
                    params: { requestId: chat.requestId },
                  })
                }
                activeOpacity={0.7}
              >
                <View style={styles.avatarSection}>
                  <View
                    style={[
                      styles.logoContainer,
                      {
                        backgroundColor:
                          otherParticipant.role === 'trucker'
                            ? '#2563eb'
                            : '#ea580c',
                      },
                    ]}
                  >
                    <ParticipantIcon size={24} color="white" />
                  </View>
                  {/* <View
                    style={[
                      {
                        backgroundColor:
                          otherParticipant.role === 'trucker'
                            ? '#2563eb'
                            : '#ea580c',
                      },
                    ]}
                  >
                    <ParticipantIcon size={12} color="white" />
                  </View> */}
                  {hasUnread && <View style={styles.unreadIndicator} />}
                </View>

                <View style={styles.contentSection}>
                  <View style={styles.topRow}>
                    <Text
                      style={[
                        styles.participantName,
                        { color: colors.text },
                        hasUnread && styles.participantNameUnread,
                      ]}
                      numberOfLines={1}
                    >
                      {otherParticipant.name}
                    </Text>
                    <View style={styles.rightSection}>
                      <Text
                        style={[
                          styles.timeText,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {chat.lastMessageTime
                          ? formatTime(chat.lastMessageTime)
                          : ''}
                      </Text>
                      {chatUnreadCount > 0 && (
                        <View style={styles.unreadBadge}>
                          <Text style={styles.unreadText}>
                            {chatUnreadCount > 9 ? '9+' : chatUnreadCount}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <Text
                    style={[
                      styles.lastMessage,
                      { color: colors.textSecondary },
                      hasUnread && { color: colors.text, fontFamily: 'Poppins_500Medium' },
                    ]}
                    numberOfLines={1}
                  >
                    {chat.lastMessage || 'No messages yet'}
                  </Text>

                  <View style={styles.bottomRow}>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: chat.isActive
                            ? '#10b981'
                            : '#6b7280',
                        },
                      ]}
                    >
                      <Text style={styles.statusText}>
                        {chat.isActive ? t('chat.active') : t('chat.completed')}
                      </Text>
                    </View>
                    <ChevronRight size={16} color={colors.textSecondary} />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerWrap: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
  },
  headerCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 26,
    fontFamily: 'Poppins_700Bold',
  },
  headerBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 999,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadgeText: {
    color: 'white',
    fontSize: 12,
    fontFamily: 'Poppins_700Bold',
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Poppins_500Medium',
    marginTop: 4,
  },
  searchHint: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchHintText: {
    fontSize: 13,
    fontFamily: 'Poppins_500Medium',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Poppins_700Bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Poppins_500Medium',
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 20,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  chatCard: {
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
  },
  chatCardUnread: {
    borderLeftWidth: 3,
    borderLeftColor: '#ef4444',
  },
  avatarSection: {
    position: 'relative',
    marginRight: 12,
  },
  logoContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  unreadIndicator: {
    position: 'absolute',
    top: -2,
    left: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ef4444',
    borderWidth: 2,
    borderColor: 'white',
  },
  contentSection: {
    flex: 1,
    minWidth: 0,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  participantName: {
    fontSize: 15,
    fontFamily: 'Poppins_700Bold',
    flex: 1,
  },
  participantNameUnread: {
    fontFamily: 'Poppins_700Bold',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unreadBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 999,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  unreadText: {
    color: 'white',
    fontSize: 10,
    fontFamily: 'Poppins_700Bold',
  },
  timeText: {
    fontSize: 11,
    fontFamily: 'Poppins_500Medium',
  },
  lastMessage: {
    fontSize: 13,
    fontFamily: 'Poppins_500Medium',
    lineHeight: 17,
    marginBottom: 6,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    color: 'white',
    fontFamily: 'Poppins_700Bold',
  },
});
