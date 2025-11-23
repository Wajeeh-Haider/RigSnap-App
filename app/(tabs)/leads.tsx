import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import {
  DollarSign,
  Clock,
  CircleCheck as CheckCircle,
  CircleX as CloseCircle,
  TrendingUp,
  RefreshCw,
  TriangleAlert as AlertTriangle,
} from 'lucide-react-native';

const getStatusColor = (status: string) => {
  switch (status) {
    case 'charged':
      return '#10b981';
    case 'pending':
      return '#f59e0b';
    case 'refunded':
      return '#ef4444';
    default:
      return '#6b7280';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'charged':
      return CheckCircle;
    case 'pending':
      return Clock;
    case 'refunded':
      return RefreshCw;
    default:
      return Clock;
  }
};

const getLeadTypeIcon = (description: string) => {
  if (description.includes('penalty')) return AlertTriangle;
  if (description.includes('refund')) return RefreshCw;
  return DollarSign;
};

const getLeadTypeColor = (description: string) => {
  if (description.includes('penalty')) return '#ef4444';
  if (description.includes('refund')) return '#10b981';
  return '#6b7280';
};

export default function LeadsScreen() {
  const { user } = useAuth();
  const { leads, requests } = useApp();
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [filter, setFilter] = useState<'all' | 'charged' | 'pending' | 'refunded' | 'penalty'>('all');

  if (!user) return null;

  // Reset filter to 'all' if provider has 'pending' or 'refunded' selected
  // Reset filter to 'all' if trucker has 'penalty' selected
  React.useEffect(() => {
    if (user.role === 'provider' && (filter === 'pending' || filter === 'refunded')) {
      setFilter('all');
    }
    if (user.role === 'trucker' && filter === 'penalty') {
      setFilter('all');
    }
  }, [user.role, filter]);

  const userLeads = leads.filter((lead) => lead.userId === user.id);
  
  // Get request information for each lead
  const leadsWithRequestInfo = userLeads.map((lead) => {
    const request = requests.find((req) => req.id === lead.requestId);
    return {
      ...lead,
      requestTitle: request?.description || 'Service Request',
      requestType: request?.serviceType || 'service',
      requestLocation: request?.location || 'Unknown Location',
      requestUrgency: request?.urgency || 'medium',
    };
  });

  const filteredLeads =
    filter === 'all'
      ? leadsWithRequestInfo
      : filter === 'penalty'
      ? leadsWithRequestInfo.filter((lead) => lead.description.includes('penalty'))
      : leadsWithRequestInfo.filter((lead) => lead.status === filter);

  const stats = {
    totalSpent: userLeads
      .filter((l) => l.status === 'charged' && l.amount > 0)
      .reduce((sum, l) => sum + l.amount, 0),
    totalRefunded: Math.abs(
      userLeads
        .filter((l) => l.status === 'charged' && l.amount < 0)
        .reduce((sum, l) => sum + l.amount, 0)
    ),
    pendingAmount: userLeads
      .filter((l) => l.status === 'pending')
      .reduce((sum, l) => sum + l.amount, 0),
    totalLeads: userLeads.filter(
      (l) =>
        !l.description.includes('penalty') && !l.description.includes('refund')
    ).length,
    penalties: userLeads.filter((l) => l.description.includes('penalty'))
      .length,
    thisMonth: userLeads.filter((l) => {
      const leadDate = new Date(l.createdAt);
      const now = new Date();
      return (
        leadDate.getMonth() === now.getMonth() &&
        leadDate.getFullYear() === now.getFullYear()
      );
    }).length,
  };

  const netSpent = stats.totalSpent - stats.totalRefunded;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <Text style={[styles.title, { color: colors.text }]}>
          {t('leads.title')}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {t('leads.monitorLeadFees')}
        </Text>
      </View>

      <View style={styles.statsContainer}>
        <View
          style={[
            styles.statCard,
            styles.totalCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.statIcon}>
            <DollarSign size={24} color="#10b981" />
          </View>
          <View style={styles.statInfo}>
            <Text style={[styles.statAmount, { color: colors.text }]}>
              ${netSpent}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              {t('leads.netSpent')}
            </Text>
          </View>
        </View>

        <View style={styles.statRow}>
          <View
            style={[
              styles.statCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.statNumber, { color: colors.text }]}>
              {stats.totalLeads}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              {t('leads.totalLeads')}
            </Text>
          </View>

          <View
            style={[
              styles.statCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.statNumber, { color: '#10b981' }]}>
              ${stats.totalRefunded}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              {t('leads.refunded')}
            </Text>
          </View>

          {user.role === 'provider' && (
            <View
              style={[
                styles.statCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.statNumber, { color: '#ef4444' }]}>
                {stats.penalties}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                {t('leads.penalties')}
              </Text>
            </View>
          )}

          {user.role === 'trucker' && (
            <View
              style={[
                styles.statCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.statNumber, { color: '#f59e0b' }]}>
                ${stats.pendingAmount}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                {t('leads.pending')}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View
        style={[
          styles.filterContainer,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {user.role === 'trucker' 
            ? ['all', 'charged', 'pending', 'refunded'].map((filterType) => (
                <TouchableOpacity
                  key={filterType}
                  style={[
                    styles.filterButton,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    filter === filterType && {
                      backgroundColor: colors.primary,
                      borderColor: colors.primary,
                    },
                  ]}
                  onPress={() => setFilter(filterType as any)}
                >
                  <Text
                    style={[
                      styles.filterText,
                      { color: colors.textSecondary },
                      filter === filterType && { color: 'white' },
                    ]}
                  >
                    {filterType === 'all'
                      ? 'All'
                      : t(`leads.${filterType}`) ||
                        filterType.charAt(0).toUpperCase() + filterType.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))
            : ['all', 'charged', 'penalty'].map((filterType) => (
                <TouchableOpacity
                  key={filterType}
                  style={[
                    styles.filterButton,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    filter === filterType && {
                      backgroundColor: colors.primary,
                      borderColor: colors.primary,
                    },
                  ]}
                  onPress={() => setFilter(filterType as any)}
                >
                  <Text
                    style={[
                      styles.filterText,
                      { color: colors.textSecondary },
                      filter === filterType && { color: 'white' },
                    ]}
                  >
                    {filterType === 'all'
                      ? 'All'
                      : t(`leads.${filterType}`) ||
                        filterType.charAt(0).toUpperCase() + filterType.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))
          }
        </ScrollView>
      </View>

      <ScrollView
        style={[styles.content, { backgroundColor: colors.background }]}
      >
        {filteredLeads.length === 0 ? (
          <View style={styles.emptyState}>
            <DollarSign size={48} color="#9ca3af" />
            <Text style={[styles.emptyStateText, { color: colors.text }]}>
              {t('leads.noLeadFeesYet')}
            </Text>
            <Text
              style={[
                styles.emptyStateSubtext,
                { color: colors.textSecondary },
              ]}
            >
              {user.role === 'trucker'
                ? t('leads.leadFeesWillAppear')
                : t('leads.leadFeesWillAppearProvider')}
            </Text>
          </View>
        ) : (
          <View style={styles.leadsContainer}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t('leads.transactionHistory')}
            </Text>
            {filteredLeads.map((lead) => {
              const StatusIcon = getStatusIcon(lead.status);
              const LeadTypeIcon = getLeadTypeIcon(lead.description);
              const leadTypeColor = getLeadTypeColor(lead.description);
              const isRefund = lead.amount < 0;
              const isPenalty = lead.description.includes('penalty');
              const isPending = lead.status === 'pending';
              const isRefunded = lead.status === 'refunded';

              return (
                <View
                  key={lead.id}
                  style={[
                    styles.leadCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View style={styles.leadHeader}>
                    <View style={styles.leadInfo}>
                      <View style={styles.leadTypeContainer}>
                        <LeadTypeIcon size={16} color={leadTypeColor} />
                        <View style={styles.statusContainer}>
                          <StatusIcon
                            size={14}
                            color={getStatusColor(lead.status)}
                          />
                          <Text
                            style={[
                              styles.statusText,
                              { color: getStatusColor(lead.status) },
                            ]}
                          >
                            {lead.status.toUpperCase()}
                          </Text>
                        </View>
                      </View>
                      <Text
                        style={[
                          styles.leadAmount,
                          {
                            color: isRefund
                              ? '#10b981'
                              : isPenalty
                              ? '#ef4444'
                              : '#1e293b',
                          },
                        ]}
                      >
                        {isRefund ? '+' : ''}${Math.abs(lead.amount).toFixed(2)}
                      </Text>
                    </View>
                    <Text style={styles.leadDate}>
                      {new Date(lead.createdAt).toLocaleDateString()}
                    </Text>
                  </View>

                  <Text
                    style={[styles.leadDescription, { color: colors.text }]}
                  >
                    {lead.requestTitle}
                  </Text>

                  <View style={styles.leadFooter}>
                    <View style={styles.requestInfo}>
                      <Text
                        style={[
                          styles.serviceType,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {lead.requestType.charAt(0).toUpperCase() + lead.requestType.slice(1)}
                      </Text>
                      <Text
                        style={[
                          styles.location,
                          { color: colors.textSecondary },
                        ]}
                      >
                        📍 {lead.requestLocation}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.roleIndicator,
                        {
                          backgroundColor: isPending
                            ? '#fef3c7'
                            : isRefunded
                            ? '#dcfce7'
                            : isPenalty
                            ? '#fef2f2'
                            : '#f1f5f9',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.roleText,
                          {
                            color: isPending
                              ? '#92400e'
                              : isRefunded
                              ? '#166534'
                              : isPenalty
                              ? '#dc2626'
                              : '#475569',
                          },
                        ]}
                      >
                        {isPending
                          ? 'Pending'
                          : isRefunded
                          ? 'Refunded'
                          : isPenalty
                          ? 'Penalty'
                          : lead.userRole === 'trucker'
                          ? 'Trucker Fee'
                          : 'Provider Fee'}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* {user.role === 'trucker' && (
        <View
          style={[
            styles.infoCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <TrendingUp size={20} color="#2563eb" />
          <View style={styles.infoText}>
            <Text style={[styles.infoTitle, { color: colors.text }]}>
              Lead Fee Information
            </Text>
            <Text
              style={[styles.infoDescription, { color: colors.textSecondary }]}
            >
              You are charged $5 when a service provider accepts your request.
              If they cancel, you get a full refund.
            </Text>
          </View>
        </View>
      )}

      {user.role === 'provider' && (
        <View
          style={[
            styles.infoCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <TrendingUp size={20} color="#ea580c" />
          <View style={styles.infoText}>
            <Text style={[styles.infoTitle, { color: colors.text }]}>
              Lead Fee & Cancellation Policy
            </Text>
            <Text
              style={[styles.infoDescription, { color: colors.textSecondary }]}
            >
              You pay $5 when accepting a request. If you cancel, youll be
              charged an additional $5 penalty fee ($10 total) while the trucker
              gets a full refund.
            </Text>
          </View>
        </View>
      )} */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 24,
    paddingTop: 10,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
  },
  statsContainer: {
    padding: 24,
    paddingTop: 16,
  },
  totalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 20,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  statInfo: {
    flex: 1,
  },
  statAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  statRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  filterContainer: {
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  filterScroll: {
    paddingHorizontal: 24,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    padding: 24,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 20,
  },
  leadsContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  leadCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
  },
  leadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  leadInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  leadTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  leadAmount: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  leadDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  leadDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  leadFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  requestId: {
    fontSize: 12,
    fontWeight: '500',
  },
  requestInfo: {
    flex: 1,
  },
  serviceType: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  location: {
    fontSize: 11,
    fontWeight: '400',
  },
  roleIndicator: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  infoCard: {
    flexDirection: 'row',
    margin: 24,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  infoDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
});
