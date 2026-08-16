import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '@/constants/colors';
import { api, ApiNotificationsResponse } from '@/lib/api';

type Notification = ApiNotificationsResponse['notifications'][number];

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await api.getNotifications();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de charger les notifications.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleTap = useCallback(async (notification: Notification) => {
    if (notification.read) return;
    // Optimistically mark as read in local state
    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n)),
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    // Persist to server — roll back optimistic update if both endpoints fail
    try {
      await api.markNotificationRead(notification.id);
    } catch {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read: false } : n)),
      );
      setUnreadCount((c) => c + 1);
    }
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        {unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{unreadCount}</Text>
          </View>
        )}
        {unreadCount === 0 && <View style={styles.badgePlaceholder} />}
      </View>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={Colors.primary} />}
        >
          {error ? (
            <View style={styles.emptyCard}>
              <Ionicons name="cloud-offline-outline" size={36} color={Colors.error} />
              <Text style={styles.emptyTitle}>Connexion indisponible</Text>
              <Text style={styles.emptyText}>{error}</Text>
              <TouchableOpacity onPress={() => load()} style={styles.retryButton}>
                <Text style={styles.retryText}>Réessayer</Text>
              </TouchableOpacity>
            </View>
          ) : notifications.length ? (
            notifications.map((notification) => (
              <TouchableOpacity
                key={notification.id}
                style={[styles.card, !notification.read && styles.unreadCard]}
                onPress={() => handleTap(notification)}
                activeOpacity={notification.read ? 1 : 0.7}
              >
                <View style={styles.iconWrap}>
                  <Ionicons
                    name={notification.read ? 'notifications-outline' : 'notifications'}
                    size={22}
                    color={Colors.primary}
                  />
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{notification.title}</Text>
                  <Text style={styles.cardText}>{notification.body}</Text>
                  <Text style={styles.date}>{new Date(notification.createdAt).toLocaleString('fr-FR')}</Text>
                </View>
                {!notification.read && <View style={styles.unreadDot} />}
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons name="notifications-off-outline" size={42} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>Aucune notification</Text>
              <Text style={styles.emptyText}>Les nouvelles commandes apparaîtront ici.</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 58, paddingBottom: 18 },
  backButton: { width: 40 },
  title: { flex: 1, color: Colors.text, fontSize: 22, fontWeight: '700' },
  unreadBadge: { minWidth: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  unreadText: { color: '#000', fontWeight: '700', fontSize: 13 },
  badgePlaceholder: { width: 28, height: 28 },
  content: { padding: 20, paddingTop: 4, gap: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { flexDirection: 'row', padding: 16, borderRadius: 16, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  unreadCard: { borderColor: Colors.primary + '70' },
  iconWrap: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.primary + '18', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  cardBody: { flex: 1 },
  cardTitle: { color: Colors.text, fontSize: 15, fontWeight: '700', marginBottom: 4 },
  cardText: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20 },
  date: { color: Colors.textMuted, fontSize: 11, marginTop: 8 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary, marginLeft: 8 },
  emptyCard: { alignItems: 'center', padding: 32, marginTop: 80, borderRadius: 18, backgroundColor: Colors.card },
  emptyTitle: { color: Colors.text, fontSize: 17, fontWeight: '700', marginTop: 14 },
  emptyText: { color: Colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  retryButton: { marginTop: 18, backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: '#000', fontWeight: '700' },
});
