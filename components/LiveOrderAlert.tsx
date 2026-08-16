import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';
import { Order } from '@/context/DriverContext';

interface LiveOrderAlertProps {
  order: Order;
  onAccept: () => void;
  onDecline: () => void;
}

const TIMEOUT_SECONDS = 25;

export function LiveOrderAlert({ order, onAccept, onDecline }: LiveOrderAlertProps) {
  const [timeLeft, setTimeLeft] = useState(TIMEOUT_SECONDS);
  const slideAnim = useRef(new Animated.Value(400)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 65,
      friction: 10,
      useNativeDriver: true,
    }).start();

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          onDecline();
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const totalItems = order.items.reduce((s, i) => s + i.quantity, 0);
  const progressWidth = `${(timeLeft / TIMEOUT_SECONDS) * 100}%`;

  const handleAccept = () => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    if (timerRef.current) clearInterval(timerRef.current);
    onAccept();
  };

  const handleDecline = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (timerRef.current) clearInterval(timerRef.current);
    onDecline();
  };

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.header}>
        <View style={styles.newBadge}>
          <Text style={styles.newBadgeText}>NOUVELLE COMMANDE</Text>
        </View>
        <Text style={[styles.timer, timeLeft < 10 ? styles.timerUrgent : null]}>
          {timeLeft}s
        </Text>
      </View>

      <View style={styles.progressBar}>
        <Animated.View style={[styles.progressFill, { width: progressWidth as any }]} />
      </View>

      <View style={styles.row}>
        <View style={styles.restaurantIcon}>
          <MaterialCommunityIcons name="store" size={24} color={Colors.primary} />
        </View>
        <View style={styles.info}>
          <Text style={styles.restaurantName}>{order.restaurant.name}</Text>
          <Text style={styles.detail}>{totalItems} article{totalItems > 1 ? 's' : ''}</Text>
        </View>
        <View style={styles.earningsBig}>
          <Text style={styles.earningsAmount}>{order.earnings.toFixed(2)} €</Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Ionicons name="location" size={14} color={Colors.tertiary} />
          <Text style={styles.metaText}>{order.distance} km</Text>
        </View>
        <View style={styles.metaDot} />
        <View style={styles.metaItem}>
          <Ionicons name="time" size={14} color={Colors.secondary} />
          <Text style={styles.metaText}>{order.estimatedDelivery} min est.</Text>
        </View>
        <View style={styles.metaDot} />
        <View style={styles.metaItem}>
          <Ionicons name="person" size={14} color={Colors.textMuted} />
          <Text style={styles.metaText}>{order.customer.name}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.declineBtn} onPress={handleDecline} activeOpacity={0.8}>
          <Ionicons name="close" size={22} color={Colors.error} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.acceptBtn} onPress={handleAccept} activeOpacity={0.8}>
          <Ionicons name="checkmark" size={20} color="#000" />
          <Text style={styles.acceptText}>Accepter</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 90,
    left: 16,
    right: 16,
    backgroundColor: Colors.card,
    borderRadius: Colors.radiusLg,
    padding: 18,
    borderWidth: 1.5,
    borderColor: Colors.primary + '60',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
    zIndex: 1000,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  newBadge: {
    backgroundColor: 'rgba(233,30,140,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.primary + '40',
  },
  newBadgeText: {
    color: Colors.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  timer: {
    color: Colors.textSecondary,
    fontSize: 18,
    fontWeight: '800',
  },
  timerUrgent: {
    color: Colors.error,
  },
  progressBar: {
    height: 3,
    backgroundColor: Colors.border,
    borderRadius: 2,
    marginBottom: 14,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  restaurantIcon: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: 'rgba(233,30,140,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
  },
  restaurantName: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  detail: {
    color: Colors.textMuted,
    fontSize: 13,
  },
  earningsBig: {
    alignItems: 'flex-end',
  },
  earningsAmount: {
    color: Colors.success,
    fontSize: 22,
    fontWeight: '800',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.border,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  declineBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.errorBg,
    borderWidth: 1.5,
    borderColor: Colors.error + '40',
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtn: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.success,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  acceptText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '800',
  },
});
