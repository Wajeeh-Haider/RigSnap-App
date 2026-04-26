import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Bell, Clock, CircleCheck as CheckCircle } from 'lucide-react-native';
import { ServiceRequest } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import { useTheme } from '@/context/ThemeContext';

export default function NotificationsScreen() {
  const { user } = useAuth();
  const { getUserRequests, getProviderRequests } = useApp();
  const { colors } = useTheme();

  if (!user) return null;

  const isTrucker = user.role === 'trucker';

  const truckerRequests = useMemo(() => {
    if (!isTrucker) return [];
    return getUserRequests(user.id).filter(
      (r) => r.status === 'pending' || r.status === 'accepted' || r.status === 'in_progress',
    );
  }, [getUserRequests, isTrucker, user.id]);

  const providerActiveJobs = useMemo(() => {
    if (isTrucker) return [];
    return getProviderRequests(user.id).filter(
      (r) => r.status === 'accepted' || r.status === 'in_progress',
    );
  }, [getProviderRequests, isTrucker, user.id]);

  const truckerSections = useMemo(() => {
    if (!isTrucker) return [];

    return [
      {
        key: 'pending',
        title: 'Waiting for Provider',
        items: truckerRequests.filter((r) => r.status === 'pending'),
      },
      {
        key: 'accepted',
        title: 'Provider Assigned',
        items: truckerRequests.filter((r) => r.status === 'accepted'),
      },
      {
        key: 'in_progress',
        title: 'Work In Progress',
        items: truckerRequests.filter((r) => r.status === 'in_progress'),
      },
    ].filter((section) => section.items.length > 0);
  }, [isTrucker, truckerRequests]);

  const requestItems = isTrucker ? truckerRequests : providerActiveJobs;

  const renderRequestCard = (request: ServiceRequest) => {
    const isPending = request.status === 'pending';
    const statusColor = isPending ? '#f59e0b' : '#3b82f6';
    const StatusIcon = isPending ? Clock : CheckCircle;

    return (
      <TouchableOpacity
        key={request.id}
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() =>
          router.push({
            pathname: '/job-detail',
            params: { requestId: request.id },
          })
        }
      >
        <View style={styles.cardTop}>
          <View style={[styles.statusPill, { backgroundColor: statusColor + '20' }]}>
            <StatusIcon size={14} color={statusColor} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {request.status.replace('_', ' ').toUpperCase()}
            </Text>
          </View>
          <Text style={[styles.dateText, { color: colors.textSecondary }]}>
            {new Date(request.createdAt).toLocaleDateString()}
          </Text>
        </View>
        <Text style={[styles.requestTitle, { color: colors.text }]} numberOfLines={1}>
          {request.description}
        </Text>
        <Text style={[styles.requestMeta, { color: colors.textSecondary }]} numberOfLines={1}>
          {request.location}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Notifications</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {requestItems.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Bell size={36} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No notifications</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              You are all caught up for now.
            </Text>
          </View>
        ) : isTrucker ? (
          truckerSections.map((section) => (
            <View key={section.key} style={styles.sectionContainer}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{section.title}</Text>
              {section.items.map((request) => renderRequestCard(request))}
            </View>
          ))
        ) : (
          requestItems.map((request) => renderRequestCard(request))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backButton: { padding: 4 },
  headerSpacer: { width: 30 },
  title: { fontSize: 22, fontFamily: 'Poppins_700Bold' },
  content: { padding: 16, gap: 10 },
  sectionContainer: { marginBottom: 8 },
  sectionTitle: { fontSize: 14, fontFamily: 'Poppins_700Bold', marginBottom: 8 },
  emptyCard: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  emptyTitle: { marginTop: 12, fontSize: 18, fontFamily: 'Poppins_700Bold' },
  emptyText: { marginTop: 4, fontSize: 13, fontFamily: 'Poppins_500Medium' },
  card: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 10 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: { fontSize: 11, fontFamily: 'Poppins_700Bold' },
  dateText: { fontSize: 11, fontFamily: 'Poppins_500Medium' },
  requestTitle: { fontSize: 14, fontFamily: 'Poppins_500Medium', marginBottom: 4 },
  requestMeta: { fontSize: 12, fontFamily: 'Poppins_500Medium' },
});
