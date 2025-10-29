import * as React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  Alert,
} from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import { router } from 'expo-router';
import {
  Plus,
  Search,
  Clock,
  CircleCheck as CheckCircle,
  CircleAlert as AlertCircle,
  MapPin,
  Phone,
  Truck,
  Wrench,
  Settings,
  CircleDot,
  Droplets,
  Zap,
  Bell,
  Users,
  Gift,
} from 'lucide-react-native';

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

export default function HomeScreen() {
  const { user } = useAuth();
  const {
    getUserRequests,
    getProviderRequests,
    getAvailableRequests,
    getUserChats,
  } = useApp();
  const { colors } = useTheme();
  const { t } = useLanguage();

  if (!user) return null;

  const isTrucker = user.role === 'trucker';
  const userRequests = isTrucker
    ? getUserRequests(user.id)
    : getProviderRequests(user.id);
  const recentRequests = userRequests.slice(0, 3);
  const availableRequests = !isTrucker
    ? getAvailableRequests().slice(0, 2)
    : [];
  const userChats = getUserChats(user.id);
  const unreadChats = userChats.filter((chat) => chat.unreadCount > 0);

  // Calculate notification count for pending/unfinished work
  const getNotificationCount = () => {
    if (isTrucker) {
      // For truckers: count pending requests and active requests (accepted/in_progress)
      const pendingRequests = getUserRequests(user.id).filter(
        (r) =>
          r.status === 'pending' ||
          r.status === 'accepted' ||
          r.status === 'in_progress'
      );
      return pendingRequests.length;
    } else {
      // For providers: count available requests + accepted/in_progress jobs
      const availableCount = getAvailableRequests().length;
      const activeJobs = getProviderRequests(user.id).filter(
        (r) => r.status === 'accepted' || r.status === 'in_progress'
      );
      return availableCount + activeJobs.length;
    }
  };

  const notificationCount = getNotificationCount();
  const handleReferFriend = async () => {
    const referralCode = `${user.firstName.toUpperCase()}${user.id.slice(-4)}`;
    const referralMessage = `🚛 Join me on RigSnap - the best platform connecting truckers with reliable service providers!

${
  isTrucker
    ? '✅ Get help fast when you need towing, repairs, or mobile services\n✅ Connect with verified, professional service providers\n✅ Track your requests and chat directly with providers'
    : '✅ Find truckers who need your services\n✅ Grow your business with qualified leads\n✅ Get paid for quality work with verified customers'
}

Use my referral code: ${referralCode}

Download RigSnap today and get $10 credit when you complete your first ${
      isTrucker ? 'service request' : 'job'
    }!

https://rigsnap.app/download?ref=${referralCode}`;

    try {
      const result = await Share.share({
        message: referralMessage,
        title: 'Join me on RigSnap!',
      });

      if (result.action === Share.sharedAction) {
        Alert.alert(
          'Thanks for Sharing! 🎉',
          `Your referral code is ${referralCode}. You&apos;ll earn $10 credit for each friend who joins and completes their first ${
            isTrucker ? 'service request' : 'job'
          }!`,
          [{ text: 'Awesome!' }]
        );
      }
    } catch {
      Alert.alert(
        'Share RigSnap',
        `Invite friends to join RigSnap!\n\nYour referral code: ${referralCode}\n\nShare this code with friends and you&apos;ll both get $10 credit when they complete their first ${
          isTrucker ? 'service request' : 'job'
        }!`,
        [{ text: 'OK' }]
      );
    }
  };

  const handleNotifications = () => {
    if (notificationCount === 0) {
      Alert.alert(
        'Notifications',
        'You have no pending notifications at this time.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (isTrucker) {
      const pendingRequests = getUserRequests(user.id).filter(
        (r) =>
          r.status === 'pending' ||
          r.status === 'accepted' ||
          r.status === 'in_progress'
      );

      const pendingCount = pendingRequests.filter(
        (r) => r.status === 'pending'
      ).length;
      const activeCount = pendingRequests.filter(
        (r) => r.status === 'accepted' || r.status === 'in_progress'
      ).length;

      let message = '';
      if (pendingCount > 0) {
        message += `${pendingCount} pending request${
          pendingCount !== 1 ? 's' : ''
        } waiting for providers\n`;
      }
      if (activeCount > 0) {
        message += `${activeCount} active request${
          activeCount !== 1 ? 's' : ''
        } in progress`;
      }

      Alert.alert(
        `${notificationCount} Active Request${
          notificationCount !== 1 ? 's' : ''
        }`,
        message.trim(),
        [
          {
            text: 'View My Requests',
            onPress: () => {
              // For now, we'll create a simple alert showing the requests
              // In a full app, this could navigate to a dedicated requests screen
              const requestsList = pendingRequests
                .map(
                  (r) =>
                    `• ${getServiceDisplayName(
                      r.serviceType
                    )} - ${r.status.toUpperCase()}`
                )
                .join('\n');

              Alert.alert(
                'My Active Requests',
                requestsList || 'No active requests',
                [
                  { text: 'OK' },
                  {
                    text: 'Create New Request',
                    onPress: () => router.push('/create-request'),
                  },
                ]
              );
            },
          },
          { text: 'OK', style: 'cancel' },
        ]
      );
    } else {
      const availableCount = getAvailableRequests().length;
      const activeJobs = getProviderRequests(user.id).filter(
        (r) => r.status === 'accepted' || r.status === 'in_progress'
      );

      let message = '';
      if (availableCount > 0) {
        message += `${availableCount} new request${
          availableCount !== 1 ? 's' : ''
        } available to accept\n`;
      }
      if (activeJobs.length > 0) {
        message += `${activeJobs.length} active job${
          activeJobs.length !== 1 ? 's' : ''
        } in progress`;
      }

      Alert.alert(
        `${notificationCount} Notification${
          notificationCount !== 1 ? 's' : ''
        }`,
        message.trim(),
        [
          {
            text: 'Browse Requests',
            onPress: () => router.push('/browse-requests'),
          },
          { text: 'OK', style: 'cancel' },
        ]
      );
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View
        style={[
          styles.header,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <View>
          <Text style={[styles.greeting, { color: colors.textSecondary }]}>
            {t('home.welcome')}
          </Text>
          <Text style={[styles.name, { color: colors.text }]}>
            {user.firstName}!
          </Text>
        </View>
        <TouchableOpacity onPress={handleNotifications}>
          <View
            style={[
              styles.notificationIconContainer,
              { backgroundColor: colors.primary + '20' },
            ]}
          >
            <Bell size={24} color="#2563eb" />
            {notificationCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationCount}>
                  {notificationCount > 99 ? '99+' : notificationCount}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* Action Buttons Section */}
      <View style={styles.section}>
        <View style={styles.actionButtonsContainer}>
          {/* New Request Button for Truckers */}
          {isTrucker && (
            <TouchableOpacity
              style={[styles.actionButton, styles.newRequestButton]}
              onPress={() => router.push('/create-request')}
            >
              <View style={styles.actionButtonContent}>
                <View style={styles.actionButtonIconContainer}>
                  <Plus size={20} color="white" strokeWidth={3} />
                </View>
                <View style={styles.actionButtonTextContainer}>
                  <Text style={styles.actionButtonTitle}>
                    {t('home.newRequest')}
                  </Text>
                  <Text style={styles.actionButtonSubtitle}>
                    {t('home.getHelpNow')}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          )}

          {/* Browse Requests Button for Providers */}
          {!isTrucker && (
            <TouchableOpacity
              style={[styles.actionButton, styles.browseButton]}
              onPress={() => router.push('/browse-requests')}
            >
              <View style={styles.actionButtonContent}>
                <View style={styles.browseIconContainer}>
                  <Search size={20} color="white" />
                </View>
                <View style={styles.actionButtonTextContainer}>
                  <Text style={styles.browseTitle}>
                    {t('home.browseRequests')}
                  </Text>
                  <Text style={styles.browseSubtitle}>
                    {t('home.findNewJobs')}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {!isTrucker && availableRequests.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t('home.availableRequests')}
            </Text>
            <TouchableOpacity onPress={() => router.push('/browse-requests')}>
              <Text style={[styles.seeAll, { color: '#2563eb' }]}>See All</Text>
            </TouchableOpacity>
          </View>
          {availableRequests.map((request) => {
            const StatusIcon = getStatusIcon(request.status);
            const ServiceIcon = getServiceIcon(request.serviceType);
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
                onPress={() =>
                  router.push({
                    pathname: '/job-detail',
                    params: { requestId: request.id },
                  })
                }
              >
                <View style={styles.requestHeader}>
                  <View style={styles.requestType}>
                    <ServiceIcon size={16} color="#2563eb" />
                    <Text
                      style={[styles.serviceType, { color: colors.primary }]}
                    >
                      {getServiceDisplayName(request.serviceType)}
                    </Text>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusColor(request.status) },
                      ]}
                    >
                      <StatusIcon size={12} color="white" />
                      <Text style={styles.statusText}>{request.status}</Text>
                    </View>
                  </View>
                  <Text
                    style={[styles.urgencyBadge, { color: colors.warning }]}
                  >
                    {request.urgency.toUpperCase()}
                  </Text>
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
                  <Text
                    style={[styles.tapToAccept, { color: colors.secondary }]}
                  >
                    Tap to view & accept
                  </Text>
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
          })}
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {isTrucker ? t('home.recentRequests') : t('home.recentJobs')}
          </Text>
          <TouchableOpacity>
            <Text style={[styles.seeAll, { color: colors.primary }]}>
              See All
            </Text>
          </TouchableOpacity>
        </View>

        {recentRequests.length === 0 ? (
          <View
            style={[styles.emptyState, { backgroundColor: colors.surface }]}
          >
            <Text style={[styles.emptyStateText, { color: colors.text }]}>
              {isTrucker ? t('home.noRequestsYet') : t('home.noJobsYet')}
            </Text>
            <Text
              style={[
                styles.emptyStateSubtext,
                { color: colors.textSecondary },
              ]}
            >
              {isTrucker
                ? t('home.createFirstRequest')
                : t('home.browseAvailableRequests')}
            </Text>
            <TouchableOpacity
              style={[
                styles.emptyStateButton,
                { backgroundColor: colors.primary },
              ]}
              onPress={() =>
                router.push(isTrucker ? '/create-request' : '/browse-requests')
              }
            >
              {isTrucker ? (
                <Plus size={16} color="white" />
              ) : (
                <Search size={16} color="white" />
              )}
              <Text style={styles.emptyStateButtonText}>
                {isTrucker ? t('home.createRequest') : t('home.browseRequests')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          recentRequests.map((request) => {
            const StatusIcon = getStatusIcon(request.status);
            const ServiceIcon = getServiceIcon(request.serviceType);
            const hasChat = request.status !== 'pending' && request.providerId;

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
                onPress={() =>
                  router.push({
                    pathname: '/job-detail',
                    params: { requestId: request.id },
                  })
                }
              >
                <View style={styles.requestHeader}>
                  <View style={styles.requestType}>
                    <ServiceIcon size={16} color="#2563eb" />
                    <Text
                      style={[styles.serviceType, { color: colors.primary }]}
                    >
                      {getServiceDisplayName(request.serviceType)}
                    </Text>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusColor(request.status) },
                      ]}
                    >
                      <StatusIcon size={12} color="white" />
                      <Text style={styles.statusText}>{request.status}</Text>
                    </View>
                  </View>
                  <View style={styles.requestActions}>
                    {hasChat && (
                      <TouchableOpacity
                        style={[
                          styles.chatButton,
                          { backgroundColor: colors.primary + '20' },
                        ]}
                        onPress={(e) => {
                          e.stopPropagation();
                          router.push({
                            pathname: '/chat-detail',
                            params: { requestId: request.id },
                          });
                        }}
                      >
                        <Bell size={16} color={colors.primary} />
                      </TouchableOpacity>
                    )}
                    <Text
                      style={[styles.timeAgo, { color: colors.textSecondary }]}
                    >
                      {new Date(request.createdAt).toLocaleDateString()}
                    </Text>
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
                  {request.providerName && (
                    <View style={styles.detailRow}>
                      <Text
                        style={[
                          styles.detailText,
                          { color: colors.textSecondary },
                        ]}
                      >
                        Provider: {request.providerName}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.requestFooter}>
                  <Text style={[styles.tapToView, { color: colors.primary }]}>
                    {t('home.tapToView')}
                  </Text>
                  {request.estimatedCost && (
                    <Text
                      style={[styles.estimatedCost, { color: colors.success }]}
                    >
                      ${request.estimatedCost}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      {/* Refer a Friend Button - Moved to bottom and made thinner */}
      <View style={styles.referSection}>
        <TouchableOpacity
          style={styles.referButton}
          onPress={handleReferFriend}
        >
          <View style={styles.referButtonContent}>
            <View style={styles.referIconContainer}>
              <Users size={18} color="white" />
            </View>
            <View style={styles.referTextContainer}>
              <Text style={styles.referTitle}>{t('home.referFriend')}</Text>
              <Text style={styles.referSubtitle}>{t('home.shareRigSnap')}</Text>
            </View>
            <View style={styles.giftBadge}>
              <Gift size={12} color="#7c3aed" />
            </View>
          </View>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingTop: 60,
    borderBottomWidth: 1,
  },
  greeting: {
    fontSize: 16,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  notificationIconContainer: {
    position: 'relative',
    padding: 8,
    borderRadius: 20,
  },
  notificationBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  notificationCount: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  section: {
    padding: 24,
    paddingTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '500',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  newRequestButton: {
    backgroundColor: '#2563eb',
    shadowColor: '#2563eb',
  },
  browseButton: {
    backgroundColor: '#ea580c',
    shadowColor: '#ea580c',
  },
  actionButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButtonIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  browseIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionButtonTextContainer: {
    flex: 1,
  },
  actionButtonTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 2,
  },
  actionButtonSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  browseTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 2,
  },
  browseSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  requestCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  requestType: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  serviceType: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  statusText: {
    fontSize: 10,
    color: 'white',
    fontWeight: '500',
  },
  requestActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    position: 'relative',
  },
  chatButton: {
    padding: 4,
    borderRadius: 6,
  },
  urgencyBadge: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  timeAgo: {
    fontSize: 12,
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
  },
  requestFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(107, 114, 128, 0.2)',
  },
  availableRequestFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(107, 114, 128, 0.2)',
  },
  tapToView: {
    fontSize: 12,
    fontWeight: '500',
  },
  tapToAccept: {
    fontSize: 12,
    fontWeight: '600',
  },
  estimatedCost: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  emptyStateSubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  emptyStateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
  },
  emptyStateButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  // Refer a Friend Section - Moved to bottom and made thinner
  referSection: {
    padding: 24,
    paddingTop: 8,
    paddingBottom: 32,
  },
  referButton: {
    backgroundColor: '#7c3aed',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  referButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  referIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  referTextContainer: {
    flex: 1,
  },
  referTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 2,
  },
  referSubtitle: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 14,
  },
  giftBadge: {
    position: 'absolute',
    top: -6,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
});
