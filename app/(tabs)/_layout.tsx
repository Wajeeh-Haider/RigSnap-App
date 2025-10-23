import { Tabs } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import { Chrome as Home, User, DollarSign, MessageCircle } from 'lucide-react-native';
import { View, Text, StyleSheet } from 'react-native';

export default function TabLayout() {
  const { user } = useAuth();
  const { getUserChats } = useApp();
  const { colors } = useTheme();
  const { t } = useLanguage();

  console.log('TabLayout - user:', user?.email, user?.role);

  if (!user) {
    console.log('TabLayout - no user, returning null');
    // Return null to let the main app handle authentication routing
    return null;
  }

  console.log('TabLayout - rendering tabs for user:', user.role);
  const isTrucker = user.role === 'trucker';
  const userChats = getUserChats(user.id);
  // Calculate total unread messages from other users only
  const { messages } = useApp();
  const unreadCount = messages.filter(message => 
    message.senderId !== user.id && 
    !message.isRead &&
    userChats.some(chat => chat.requestId === message.requestId)
  ).length;

  console.log('TabLayout - unread count:', unreadCount);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: isTrucker ? '#2563eb' : '#ea580c',
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingBottom: 8,
          paddingTop: 8,
          height: 80,
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
          marginTop: 4,
        },
        tabBarItemStyle: {
          paddingVertical: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('nav.home'),
          tabBarIcon: ({ size, color }) => (
            <Home size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="chat"
        options={{
          title: t('nav.messages'),
          tabBarBadge: unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount.toString()) : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#ef4444',
            color: 'white',
            fontSize: 11,
            fontWeight: 'bold',
            minWidth: 20,
            height: 20,
            borderRadius: 10,
            textAlign: 'center',
            lineHeight: 20,
            marginTop: -2,
          },
          tabBarIcon: ({ size, color }) => (
            <MessageCircle size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="leads"
        options={{
          title: t('nav.leads'),
          tabBarIcon: ({ size, color }) => (
            <DollarSign size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: t('nav.profile'),
          tabBarIcon: ({ size, color }) => (
            <User size={size} color={color} />
          ),
        }}
      />

      {/* Keep screens accessible but hide them from tabs */}
      <Tabs.Screen
        name="create-request"
        options={{
          href: null, // This hides the tab from the tab bar
        }}
      />

      <Tabs.Screen
        name="browse-requests"
        options={{
          href: null, // This hides the tab from the tab bar
        }}
      />

      <Tabs.Screen
        name="account-settings"
        options={{
          href: null, // This hides the tab from the tab bar
        }}
      />

      <Tabs.Screen
        name="chat-detail"
        options={{
          href: null, // This hides the tab from the tab bar
        }}
      />

      <Tabs.Screen
        name="job-detail"
        options={{
          href: null, // This hides the tab from the tab bar
        }}
      />

      <Tabs.Screen
        name="privacy-policy"
        options={{
          href: null, // This hides the tab from the tab bar
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  // Remove unused styles since we're using built-in tabBarBadge
});