import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useDriver } from '@/context/DriverContext';
import { OrderCard } from '@/components/OrderCard';

const STATUS_LABELS: Record<string, string> = {
  accepted: 'Acceptée',
  at_restaurant: 'Au restaurant',
  picked_up: 'Récupérée',
  delivering: 'En livraison',
};

function ActiveOrderBanner() {
  const { activeOrder } = useDriver();
  if (!activeOrder) return null;

  const statusLabel = STATUS_LABELS[activeOrder.status] ?? 'En cours';

  return (
    <TouchableOpacity
      style={styles.activeBanner}
      onPress={() => router.push(`/order/${activeOrder.id}`)}
      activeOpacity={0.85}
    >
      <View style={styles.activeBannerLeft}>
        <View style={styles.activePulse} />
        <View>
          <Text style={styles.activeBannerLabel}>Commande en cours</Text>
          <Text style={styles.activeBannerRestaurant}>{activeOrder.restaurant.name}</Text>
        </View>
      </View>
      <View style={styles.activeBannerRight}>
        <Text style={styles.activeBannerStatus}>{statusLabel}</Text>
        <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
      </View>
    </TouchableOpacity>
  );
}

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const { activeOrder, status, history } = useDriver();

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : 0;

  const recentCompleted = history.slice(0, 3);

  return (
    <View style={[styles.container, { paddingTop: topPad, paddingBottom: botPad }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Commandes</Text>
        {status === 'busy' && activeOrder && (
          <View style={styles.busyBadge}>
            <Text style={styles.busyText}>1 active</Text>
          </View>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <ActiveOrderBanner />

        {!activeOrder && status !== 'online' && (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={52} color={Colors.border} />
            <Text style={styles.emptyTitle}>Pas de commande active</Text>
            <Text style={styles.emptySubtitle}>Mettez-vous en ligne pour recevoir des commandes</Text>
          </View>
        )}

        {!activeOrder && status === 'online' && (
          <View style={styles.waitingState}>
            <View style={styles.waitingDot} />
            <Text style={styles.waitingText}>En attente de commandes...</Text>
          </View>
        )}

        {recentCompleted.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Récentes</Text>
              <TouchableOpacity onPress={() => router.push('/history')}>
                <Text style={styles.seeAll}>Voir tout</Text>
              </TouchableOpacity>
            </View>
            {recentCompleted.map((order) => (
              <View key={order.id} style={styles.completedCard}>
                <View style={styles.completedLeft}>
                  <View style={styles.completedIcon}>
                    <Ionicons name="checkmark-circle" size={22} color={Colors.success} />
                  </View>
                  <View>
                    <Text style={styles.completedRestaurant}>{order.restaurant.name}</Text>
                    <Text style={styles.completedCustomer}>{order.customer.name}</Text>
                  </View>
                </View>
                <View style={styles.completedRight}>
                  <Text style={styles.completedEarnings}>+{order.earnings.toFixed(2)} €</Text>
                  {order.rating !== undefined && (
                    <View style={styles.ratingRow}>
                      <Ionicons name="star" size={12} color={Colors.secondary} />
                      <Text style={styles.ratingText}>{order.rating}.0</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    color: Colors.text,
    fontSize: 28,
    fontFamily: 'Poppins_800ExtraBold',
    letterSpacing: -0.5,
  },
  busyBadge: {
    backgroundColor: 'rgba(233,30,140,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.primary + '40',
  },
  busyText: {
    color: Colors.primary,
    fontSize: 12,
    fontFamily: 'Poppins_600SemiBold',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  activeBanner: {
    backgroundColor: Colors.card,
    borderRadius: Colors.radius,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: Colors.primary + '50',
    marginBottom: 20,
  },
  activeBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  activePulse: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  activeBannerLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontFamily: 'Poppins_500Medium',
    marginBottom: 2,
  },
  activeBannerRestaurant: {
    color: Colors.text,
    fontSize: 15,
    fontFamily: 'Poppins_700Bold',
  },
  activeBannerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activeBannerStatus: {
    color: Colors.primary,
    fontSize: 13,
    fontFamily: 'Poppins_600SemiBold',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyTitle: {
    color: Colors.textSecondary,
    fontSize: 18,
    fontFamily: 'Poppins_700Bold',
  },
  emptySubtitle: {
    color: Colors.textMuted,
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  waitingState: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 40,
  },
  waitingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.success,
  },
  waitingText: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontFamily: 'Poppins_500Medium',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 17,
    fontFamily: 'Poppins_700Bold',
  },
  seeAll: {
    color: Colors.primary,
    fontSize: 13,
    fontFamily: 'Poppins_600SemiBold',
  },
  completedCard: {
    backgroundColor: Colors.card,
    borderRadius: Colors.radius,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  completedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  completedIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: Colors.successBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedRestaurant: {
    color: Colors.text,
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
    marginBottom: 2,
  },
  completedCustomer: {
    color: Colors.textMuted,
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
  },
  completedRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  completedEarnings: {
    color: Colors.success,
    fontSize: 15,
    fontFamily: 'Poppins_700Bold',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingText: {
    color: Colors.secondary,
    fontSize: 12,
    fontFamily: 'Poppins_600SemiBold',
  },
});
