import * as React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import { getUserCredits, getUserReferralCode } from '@/utils/creditOperations';
import { router } from 'expo-router';
import { locationService } from '@/utils/location';
import { useToast } from '@/hooks/useToast';
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
  X,
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
  const { user, updateProfile } = useAuth();
  const {
    getUserRequests,
    getProviderRequests,
    getAvailableRequests,
    refreshRequests,
    cancelRequest,
  } = useApp();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { showError, showSuccess, showInfo } = useToast();
  const [refreshing, setRefreshing] = React.useState(false);
  const [availableRequests, setAvailableRequests] = React.useState<any[]>([]);
  const [referralCode, setReferralCode] = React.useState<string | null>(null);
  const [userCredits, setUserCredits] = React.useState<number>(0);
  const refreshSpinnerColor = colors.primary;
  const refreshBackgroundColor = colors.surface;
  const locationUpdatedRef = React.useRef(false);
  const lastLocationUpdateRef = React.useRef<number>(0);
  const loadAvailableRequestsRef = React.useRef<() => Promise<void>>(async () => {});
  const loadReferralDataRef = React.useRef<() => Promise<void>>(async () => {});
  const userId = user?.id;
  const userRole = user?.role;
  const userLocation = user?.location;
  const userFirstName = user?.firstName;

  // Load referral code and credit balance
  const loadReferralData = React.useCallback(async () => {
    if (!userId) return;

    try {
      const [code, credits] = await Promise.all([
        getUserReferralCode(userId),
        getUserCredits(userId),
      ]);

      setReferralCode(code);
      setUserCredits(credits?.balance || 0);
    } catch (error) {
      console.error('Error loading referral data:', error);
      // Generate fallback code if database call fails
      const fallbackCode = `${(userFirstName || 'USER').toUpperCase().slice(0, 4)}${userId.slice(-4)}`;
      setReferralCode(fallbackCode);
      setUserCredits(0);
    }
  }, [userId, userFirstName]);

  // Load available requests for providers
  const loadAvailableRequests = React.useCallback(async () => {
    if (!userId || userRole === 'trucker') {
      setAvailableRequests([]);
      return;
    }

    try {
      // Update provider's location with current live location for radius filtering
      // Only update if location has changed significantly and enough time has passed
      if (!locationUpdatedRef.current) {
        try {
          const currentLocation = await locationService.getCurrentPosition();
          const coords = `${currentLocation.coords.latitude},${currentLocation.coords.longitude}`;
          const now = Date.now();

          // Skip update if location hasn't changed or updated recently (within 5 minutes)
          if (
            coords !== userLocation &&
            now - lastLocationUpdateRef.current > 5 * 60 * 1000
          ) {
            // Update the provider's location in database
            await updateProfile({ location: coords });
            lastLocationUpdateRef.current = now;
            console.log(
              'Updated provider live location for radius filtering:',
              coords,
            );
          } else {
            console.log(
              'Location unchanged or updated recently, skipping update',
            );
          }

          locationUpdatedRef.current = true;
        } catch (locationError: any) {
          // Log as warning instead of error as this is common in simulators/certain environments
          if (
            locationError?.code === 'ERR_LOCATION_UNAVAILABLE' ||
            locationError?.message?.includes('kCLErrorDomain error 0')
          ) {
            console.warn(
              'Live location unavailable (Simulator / GPS issue). Using profile location as fallback.',
            );
          } else {
            console.warn(
              'Failed to get/update live location:',
              locationError?.message || locationError,
            );
          }
          // Mark as updated even on failure to prevent infinite retry loops in current focus session
          locationUpdatedRef.current = true;
        }
      }

      const requests = await getAvailableRequests(userId);
      setAvailableRequests(requests.slice(0, 2));
    } catch (error) {
      console.error('Error loading available requests:', error);
      setAvailableRequests([]);
    }
  }, [userId, userRole, userLocation, getAvailableRequests, updateProfile]);

  React.useEffect(() => {
    loadAvailableRequestsRef.current = loadAvailableRequests;
  }, [loadAvailableRequests]);

  React.useEffect(() => {
    loadReferralDataRef.current = loadReferralData;
  }, [loadReferralData]);

  // Refresh data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (!userId) return;
      // Reset location updated flag when screen comes into focus
      locationUpdatedRef.current = false;
      refreshRequests();
      loadAvailableRequestsRef.current();
      loadReferralDataRef.current();
    }, [userId, refreshRequests]),
  );

  // Load available requests on mount and when user changes
  React.useEffect(() => {
    loadAvailableRequestsRef.current();
  }, [userId]);

  // Handle pull-to-refresh
  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshRequests();
      await loadAvailableRequests();
      await loadReferralData();
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  }, [refreshRequests, loadAvailableRequests, loadReferralData]);

  if (!user) return null;

  const isTrucker = user.role === 'trucker';
  const userRequests = isTrucker
    ? getUserRequests(user.id)
    : getProviderRequests(user.id);
  const recentRequests = userRequests.slice(0, 3);
  // availableRequests is managed by state

  // Calculate notification count for pending/unfinished work
  const getNotificationCount = () => {
    if (isTrucker) {
      // For truckers: count pending requests and active requests (accepted/in_progress)
      const pendingRequests = getUserRequests(user.id).filter(
        (r) =>
          r.status === 'pending' ||
          r.status === 'accepted' ||
          r.status === 'in_progress',
      );
      return pendingRequests.length;
    } else {
      // For providers: count available requests + accepted/in_progress jobs
      const activeJobs = getProviderRequests(user.id).filter(
        (r) => r.status === 'accepted' || r.status === 'in_progress',
      );
      return availableRequests.length + activeJobs.length;
    }
  };

  const notificationCount = getNotificationCount();
  const handleReferFriend = async () => {
    if (!referralCode) {
      showError('Referral code not available. Please try again.');
      return;
    }

    const referralMessage = `🚛 Join me on RigSnap - the best platform connecting truckers with reliable service providers!

${
  isTrucker
    ? '✅ Get help fast when you need towing, repairs, or mobile services\n✅ Connect with verified, professional service providers\n✅ Track your requests and chat directly with providers'
    : '✅ Find truckers who need your services\n✅ Grow your business with qualified leads\n✅ Get paid for quality work with verified customers'
}

Use my referral code: ${referralCode}

Download RigSnap today and get $10 credit when you sign up!`;

    try {
      const result = await Share.share({
        message: referralMessage,
        title: 'Join me on RigSnap!',
      });

      if (result.action === Share.sharedAction) {
        showSuccess(
          `Shared! Your code is ${referralCode}. You earn $10 per successful referral.`,
        );
      }
    } catch {
      showInfo(`Share this referral code: ${referralCode}`);
    }
  };

  const handleNotifications = () => {
    router.push('/notifications');
  };

  const handleCancelRequest = async (requestId: string, reason: string) => {
    try {
      const success = await cancelRequest(requestId, user.id, reason);
      if (success) {
        showSuccess('Request cancelled successfully.');
      }
      // Error alert is already shown in cancelRequest if payment fails
    } catch (error: any) {
      showError(error.message || 'Failed to cancel request. Please try again.');
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[refreshSpinnerColor]}
          tintColor={refreshSpinnerColor}
          progressBackgroundColor={refreshBackgroundColor}
          title="Pull to refresh"
          titleColor={colors.textSecondary}
        />
      }
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
                  {notificationCount > 10 ? '9+' : notificationCount}
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

      {/* Referral Section */}
      <View style={styles.section}>
        <TouchableOpacity
          style={[
            styles.referralCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          onPress={handleReferFriend}
        >
          <View style={styles.referralContent}>
            <View style={styles.referralIcon}>
              <Gift size={24} color="#2563eb" />
            </View>
            <View style={styles.referralTextContainer}>
              <Text style={[styles.referralMainText, { color: colors.text }]}>
                You both get $10!
              </Text>
              <Text
                style={[
                  styles.referralSubText,
                  { color: colors.textSecondary },
                ]}
              >
                Your referral code: {referralCode || 'Loading...'}
              </Text>
              {userCredits > 0 && (
                <Text style={[styles.referralCredits, { color: '#10b981' }]}>
                  Credits: ${userCredits.toFixed(2)}
                </Text>
              )}
            </View>
            <View style={styles.referralArrow}>
              <Users size={20} color="#2563eb" />
            </View>
          </View>
        </TouchableOpacity>
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
                      <Text style={styles.statusText}>
                        {request.status.replace('_', ' ').toUpperCase()}
                      </Text>
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
          <TouchableOpacity onPress={() => router.push('/browse-requests')}>
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
                      <Text style={styles.statusText}>
                        {request.status.replace('_', ' ').toUpperCase()}
                      </Text>
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
                    {/* Cancel button for truckers on pending requests */}
                    {isTrucker && request.status === 'pending' && (
                      <TouchableOpacity
                        style={[
                          styles.cancelButton,
                          { backgroundColor: colors.error + '20' },
                        ]}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleCancelRequest(request.id, 'Cancelled by user');
                        }}
                      >
                        <X size={16} color={colors.error} />
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
      {/* <View style={styles.referSection}>
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
      </View> */}
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
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  greeting: {
    fontSize: 16,
    fontFamily: 'Poppins_500Medium',
  },
  name: {
    fontSize: 24,
    fontFamily: 'Poppins_700Bold',
  },
  notificationIconContainer: {
    position: 'relative',
    padding: 8,
    borderRadius: 20,
  },

  notificationBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#ef4444',
    borderRadius: 20,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6, // allows width to grow for 3 digits
    alignItems: 'center',
    justifyContent: 'center',
  },

  notificationCount: {
    color: 'white',
    fontSize: 10, // smaller to fit 3 digits
    fontFamily: 'Poppins_700Bold',
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
    fontFamily: 'Poppins_700Bold',
  },
  seeAll: {
    fontSize: 14,
    fontFamily: 'Poppins_500Medium',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    marginBottom: -16,
    marginTop: 10,
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
    fontFamily: 'Poppins_700Bold',
    color: 'white',
    marginBottom: 2,
  },
  actionButtonSubtitle: {
    fontSize: 12,
    fontFamily: 'Poppins_500Medium',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  browseTitle: {
    fontSize: 16,
    fontFamily: 'Poppins_700Bold',
    color: 'white',
    marginBottom: 2,
  },
  browseSubtitle: {
    fontSize: 12,
    fontFamily: 'Poppins_500Medium',
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
    fontFamily: 'Poppins_700Bold',
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
    fontSize: 9,
    color: 'white',
    textTransform: 'capitalize',
    fontFamily: 'Poppins_500Medium',
    textAlign: 'center',
    flexShrink: 1,
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
  cancelButton: {
    padding: 4,
    borderRadius: 6,
  },
  urgencyBadge: {
    fontSize: 10,
    fontFamily: 'Poppins_700Bold',
  },
  timeAgo: {
    fontSize: 12,
    fontFamily: 'Poppins_500Medium',
  },
  requestDescription: {
    fontSize: 14,
    fontFamily: 'Poppins_500Medium',
    lineHeight: 20,
    marginBottom: 12,
  },
  requestDetails: {
    gap: 4,
    marginBottom: 12,
    marginRight: 20,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 12,
    fontFamily: 'Poppins_500Medium',
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
    fontFamily: 'Poppins_500Medium',
  },
  tapToAccept: {
    fontSize: 12,
    fontFamily: 'Poppins_500Medium',
  },
  estimatedCost: {
    fontSize: 14,
    fontFamily: 'Poppins_500Medium',
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
    fontFamily: 'Poppins_700Bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    fontFamily: 'Poppins_500Medium',
    marginBottom: 16,
    textAlign: 'center',
  },
  emptyStateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  emptyStateButtonText: {
    color: 'white',
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
  },
  referSection: {
    padding: 24,
    paddingTop: 0,
    paddingBottom: 32,
  },
  referButton: {
    borderRadius: 12,
    backgroundColor: '#7c3aed',
    padding: 16,
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  referButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  referIconContainer: {
    marginRight: 12,
  },
  referTextContainer: {
    flex: 1,
  },
  referTitle: {
    color: 'white',
    fontSize: 14,
    fontFamily: 'Poppins_700Bold',
  },
  referSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 11,
    fontFamily: 'Poppins_500Medium',
  },
  giftBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 6,
    borderRadius: 8,
  },
  // Referral section styles
  // Referral Card styles
  referralCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  referralContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  referralIcon: {
    marginRight: 12,
  },
  referralTextContainer: {
    flex: 1,
  },
  referralMainText: {
    fontSize: 16,
    fontFamily: 'Poppins_700Bold',
    marginBottom: 4,
  },
  referralSubText: {
    fontSize: 12,
    fontFamily: 'Poppins_500Medium',
  },
  referralCredits: {
    fontSize: 12,
    fontFamily: 'Poppins_700Bold',
    marginTop: 2,
  },
  referralArrow: {
    marginLeft: 12,
  },
});
