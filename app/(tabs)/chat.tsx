import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import { MessageCircle, Truck, Shield } from 'lucide-react-native';

export default function ChatListScreen() {
  const { user } = useAuth();
  const { getUserChats, messages } = useApp();
  const { colors } = useTheme();
  const { t } = useLanguage();

  if (!user) return null;

  const userChats = getUserChats(user.id);

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
      <View
        style={[
          styles.header,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <Text style={[styles.title, { color: colors.text }]}>
          {t('chat.title')}
        </Text>
        {totalUnreadCount > 0 && (
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>
              {totalUnreadCount} unread
            </Text>
          </View>
        )}
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {user.role === 'trucker'
            ? t('chat.messagesWillAppear')
            : t('chat.messagesWillAppearProvider')}
        </Text>
      </View>

      {userChats.length === 0 ? (
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
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
        >
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
                  <View
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
                  </View>
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
                      {chatUnreadCount > 0 && (
                        <View style={styles.unreadBadge}>
                          <Text style={styles.unreadText}>
                            {chatUnreadCount > 9 ? '9+' : chatUnreadCount}
                          </Text>
                        </View>
                      )}
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
                    </View>
                  </View>

                  <Text
                    style={[
                      styles.lastMessage,
                      { color: colors.textSecondary },
                      hasUnread && { color: colors.text, fontWeight: '500' },
                    ]}
                    numberOfLines={2}
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
  header: {
    padding: 24,
    paddingTop: 60,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerBadge: {
    position: 'absolute',
    top: 70,
    right: 24,
    backgroundColor: '#ef4444',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  headerBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 18,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 20,
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  chatCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
  },
  chatCardUnread: {
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  avatarSection: {
    position: 'relative',
    marginRight: 16,
  },
  logoContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
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
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  participantName: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  participantNameUnread: {
    fontWeight: '800',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unreadBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  timeText: {
    fontSize: 12,
  },
  lastMessage: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
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
});
