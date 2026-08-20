import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { Order } from '@/context/DriverContext';

interface OrderCardProps {
  order: Order;
  onPress?: () => void;
  compact?: boolean;
}

export function OrderCard({ order, onPress, compact = false }: OrderCardProps) {
  const totalItems = order.items.reduce((s, i) => s + i.quantity, 0);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.header}>
        <View style={styles.restaurantIcon}>
          <MaterialCommunityIcons name="store" size={22} color={Colors.primary} />
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.restaurantName} numberOfLines={1}>{order.restaurant.name}</Text>
          <Text style={styles.reference} numberOfLines={1}>{order.reference}</Text>
          <Text style={styles.restaurantAddress} numberOfLines={1}>{order.restaurant.address}</Text>
        </View>
        <View style={styles.earningsBadge}>
          <Text style={styles.earningsText}>{order.earnings.toFixed(2)}€</Text>
        </View>
      </View>

      {!compact && (
        <View style={styles.divider} />
      )}

      <View style={styles.stats}>
        <View style={styles.statItem}>
          <Ionicons name="location-outline" size={15} color={Colors.tertiary} />
          <Text style={styles.statText}>{order.distance} km</Text>
        </View>
        <View style={styles.statDot} />
        <View style={styles.statItem}>
          <Ionicons name="time-outline" size={15} color={Colors.secondary} />
          <Text style={styles.statText}>{order.estimatedDelivery} min</Text>
        </View>
        <View style={styles.statDot} />
        <View style={styles.statItem}>
          <Ionicons name="restaurant-outline" size={15} color={Colors.textMuted} />
          <Text style={styles.statText}>{totalItems} article{totalItems > 1 ? 's' : ''}</Text>
        </View>
      </View>

      {!compact && (
        <View style={styles.customerRow}>
          <Ionicons name="person-circle-outline" size={16} color={Colors.textMuted} />
          <Text style={styles.customerText}>{order.customer.name}</Text>
          <Text style={styles.customerAddress} numberOfLines={1}>{order.customer.address}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Colors.radius,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  restaurantIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(233,30,140,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  restaurantName: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  restaurantAddress: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  reference: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  earningsBadge: {
    backgroundColor: Colors.successBg,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Colors.radiusSm,
    borderWidth: 1,
    borderColor: 'rgba(0,230,118,0.2)',
  },
  earningsText: {
    color: Colors.success,
    fontSize: 15,
    fontWeight: '800',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: 12,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  statDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.border,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  customerText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginRight: 4,
  },
  customerAddress: {
    color: Colors.textMuted,
    fontSize: 12,
    flex: 1,
  },
});
