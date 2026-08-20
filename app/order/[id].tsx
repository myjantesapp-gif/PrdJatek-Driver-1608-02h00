import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Linking,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';
import { useDriver } from '@/context/DriverContext';
import { OTPInput } from '@/components/OTPInput';
import { getNextOrderStatusLabel } from '@/lib/delivery-state';

const STEPS = [
  { key: 'accepted', label: 'Commande acceptée', icon: 'checkmark-circle-outline' as const },
  { key: 'at_restaurant', label: 'Au restaurant', icon: 'storefront-outline' as const },
  { key: 'picked_up', label: 'Commande récupérée', icon: 'bag-check-outline' as const },
  { key: 'delivering', label: 'En livraison', icon: 'bicycle-outline' as const },
  { key: 'completed', label: 'Livré — OTP requis', icon: 'lock-closed-outline' as const },
];

function StepProgress({ currentStatus }: { currentStatus: string }) {
  const currentIdx = STEPS.findIndex((s) => s.key === currentStatus);
  return (
    <View style={styles.stepsContainer}>
      {STEPS.map((step, idx) => {
        const isActive = idx === currentIdx;
        const isDone = idx < currentIdx;
        return (
          <View key={step.key} style={styles.stepRow}>
            <View style={styles.stepLeft}>
              <View
                style={[
                  styles.stepCircle,
                  isDone && styles.stepCircleDone,
                  isActive && styles.stepCircleActive,
                ]}
              >
                {isDone ? (
                  <Ionicons name="checkmark" size={14} color="#000" />
                ) : (
                  <Ionicons
                    name={step.icon}
                    size={14}
                    color={isActive ? '#000' : Colors.textMuted}
                  />
                )}
              </View>
              {idx < STEPS.length - 1 && (
                <View style={[styles.stepLine, isDone && styles.stepLineDone]} />
              )}
            </View>
            <Text
              style={[
                styles.stepLabel,
                isActive && styles.stepLabelActive,
                isDone && styles.stepLabelDone,
              ]}
            >
              {step.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { activeOrder, terminalOrder, updateOrderStatus, validateOTP } = useDriver();
  const [retainedOrder, setRetainedOrder] = useState<typeof activeOrder>(null);
  const [otpError, setOtpError] = useState(false);
  const [otpSuccess, setOtpSuccess] = useState(false);
  const [otpSubmitting, setOtpSubmitting] = useState(false);
  const [advancing, setAdvancing] = useState(false); // guard duplicate status transitions
  const [otpKey, setOtpKey] = useState(0); // increment to reset OTPInput boxes
  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Clean up pending timers on unmount to avoid state updates on an unmounted screen
  useEffect(() => {
    return () => {
      timerRefs.current.forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    if (activeOrder?.id === id) {
      setRetainedOrder(activeOrder);
    }
  }, [activeOrder, id]);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom + 16;
  const order = terminalOrder?.id === id
    ? terminalOrder
    : activeOrder?.id === id
      ? activeOrder
      : retainedOrder?.id === id
        ? retainedOrder
        : null;

  if (!order) {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <View style={styles.notFoundContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.notFoundText}>Synchronisation de la commande...</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const advanceStatus = async () => {
    if (advancing) return;
    setAdvancing(true);
    try {
      const currentIdx = STEPS.findIndex((s) => s.key === order.status);
      if (order.status === 'picked_up') {
        const updated = await updateOrderStatus(order.id, 'delivering');
        if (updated && Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
      } else if (currentIdx >= 0 && currentIdx < STEPS.length - 2) {
        const nextStatus = STEPS[currentIdx + 1].key as any;
        const updated = await updateOrderStatus(order.id, nextStatus);
        if (updated && Platform.OS !== 'web') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
      }
    } finally {
      setAdvancing(false);
    }
  };

  const handleOTP = async (code: string) => {
    if (otpSubmitting) return;
    setOtpSubmitting(true);
    setOtpError(false);

    try {
      const ok = await validateOTP(order.id, code);
      if (ok) {
        setOtpSuccess(true);
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        timerRefs.current.push(setTimeout(() => router.back(), 1500));
      } else {
        setOtpError(true);
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        }
        // Reset input boxes so driver can re-enter the code
        timerRefs.current.push(setTimeout(() => {
          setOtpError(false);
          setOtpKey((k) => k + 1);
        }, 1200));
      }
    } finally {
      setOtpSubmitting(false);
    }
  };

  const callContact = async (phone: string) => {
    const normalizedPhone = phone?.trim();
    if (!normalizedPhone) return;
    try {
      const url = `tel:${normalizedPhone}`;
      if (await Linking.canOpenURL(url)) {
        await Linking.openURL(url);
      }
    } catch {
      // Calling is not supported by this device.
    }
  };

  const openMap = async (lat: number, lng: number) => {
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180 ||
      (lat === 0 && lng === 0)
    ) {
      return;
    }
    const nativeUrl = Platform.OS === 'ios'
      ? `maps:0,0?q=Destination@${lat},${lng}`
      : `geo:${lat},${lng}?q=${lat},${lng}`;
    const fallbackUrl = `https://maps.google.com/?q=${encodeURIComponent(`${lat},${lng}`)}`;
    try {
      const canOpenNative = await Linking.canOpenURL(nativeUrl);
      await Linking.openURL(canOpenNative ? nativeUrl : fallbackUrl);
    } catch {
      try {
        await Linking.openURL(fallbackUrl);
      } catch {
        // No browser or maps app is available.
      }
    }
  };

  const isDelivering = order.status === 'delivering';
  const totalItems = order.items.reduce((s, i) => s + i.quantity, 0);
  const subtotal = order.items.reduce((s, i) => s + i.price * i.quantity, 0);

  const nextLabel = getNextOrderStatusLabel(order.status);

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Commande #{order.id.slice(-6).toUpperCase()}</Text>
        <View style={styles.earningsBadge}>
          <Text style={styles.earningsText}>{order.earnings.toFixed(2)} €</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <StepProgress currentStatus={order.status} />

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="store" size={18} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Restaurant</Text>
          </View>
          <Text style={styles.placeName}>{order.restaurant.name}</Text>
          <Text style={styles.placeAddress}>{order.restaurant.address}</Text>
          <View style={styles.contactRow}>
            <TouchableOpacity
              style={styles.contactBtn}
              onPress={() => callContact(order.restaurant.phone)}
            >
              <Ionicons name="call" size={16} color={Colors.primary} />
              <Text style={styles.contactBtnText}>Appeler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.contactBtn, { borderColor: Colors.tertiary + '40' }]}
              onPress={() => openMap(order.restaurant.lat, order.restaurant.lng)}
            >
              <Ionicons name="navigate" size={16} color={Colors.tertiary} />
              <Text style={[styles.contactBtnText, { color: Colors.tertiary }]}>Naviguer</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="person" size={18} color={Colors.tertiary} />
            <Text style={styles.sectionTitle}>Client</Text>
          </View>
          <Text style={styles.placeName}>{order.customer.name}</Text>
          <Text style={styles.placeAddress}>{order.customer.address}</Text>
          <View style={styles.contactRow}>
            <TouchableOpacity
              style={[styles.contactBtn, { borderColor: Colors.tertiary + '40' }]}
              onPress={() => callContact(order.customer.phone)}
            >
              <Ionicons name="call" size={16} color={Colors.tertiary} />
              <Text style={[styles.contactBtnText, { color: Colors.tertiary }]}>Appeler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.contactBtn, { borderColor: Colors.success + '40' }]}
              onPress={() => openMap(order.customer.lat, order.customer.lng)}
            >
              <Ionicons name="navigate" size={16} color={Colors.success} />
              <Text style={[styles.contactBtnText, { color: Colors.success }]}>Naviguer</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="restaurant" size={18} color={Colors.secondary} />
            <Text style={styles.sectionTitle}>Articles ({totalItems})</Text>
          </View>
          {order.items.map((item, i) => (
            <View key={i} style={styles.itemRow}>
              <View style={styles.itemQtyBadge}>
                <Text style={styles.itemQty}>{item.quantity}</Text>
              </View>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemPrice}>{(item.price * item.quantity).toFixed(2)} €</Text>
            </View>
          ))}
          <View style={styles.subtotalRow}>
            <Text style={styles.subtotalLabel}>Sous-total</Text>
            <Text style={styles.subtotalValue}>{subtotal.toFixed(2)} €</Text>
          </View>
          {order.tip > 0 && (
            <View style={styles.subtotalRow}>
              <Text style={styles.subtotalLabel}>Pourboire</Text>
              <Text style={[styles.subtotalValue, { color: Colors.success }]}>+{order.tip.toFixed(2)} €</Text>
            </View>
          )}
        </View>

        {isDelivering && !otpSuccess && (
          <View style={styles.otpSection}>
            <View style={styles.otpHeader}>
              <Ionicons name="lock-closed" size={22} color={Colors.primary} />
              <Text style={styles.otpTitle}>Code OTP de livraison</Text>
            </View>
            <Text style={styles.otpSubtitle}>
              Demandez le code à 4 chiffres au client pour confirmer la livraison
            </Text>
            <OTPInput key={otpKey} length={4} onComplete={handleOTP} error={otpError} />
            {otpError && (
              <Text style={styles.otpError}>Code incorrect. Vérifiez avec le client.</Text>
            )}
          </View>
        )}

        {(otpSuccess || order.status === 'completed') && (
          <View style={styles.successBox}>
            <Ionicons name="checkmark-circle" size={40} color={Colors.success} />
            <Text style={styles.successTitle}>Livraison confirmée !</Text>
            <Text style={styles.successSub}>+{order.earnings.toFixed(2)} € ajoutés</Text>
          </View>
        )}

        {order.status === 'cancelled' && (
          <View style={styles.cancelledBox}>
            <Ionicons name="close-circle" size={34} color={Colors.error} />
            <Text style={styles.cancelledTitle}>Commande annulée</Text>
            <Text style={styles.cancelledSub}>Cette commande a été annulée par le serveur.</Text>
          </View>
        )}
      </ScrollView>

      {nextLabel && (
        <View style={[styles.footer, { paddingBottom: botPad }]}>
          <TouchableOpacity
            style={[styles.advanceBtn, advancing && styles.advanceBtnDisabled]}
            onPress={advanceStatus}
            disabled={advancing}
            activeOpacity={0.85}
          >
            {advancing ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <>
                <Text style={styles.advanceBtnText}>{nextLabel}</Text>
                <Ionicons name="arrow-forward" size={18} color="#000" />
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
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
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: Colors.text,
    fontSize: 16,
    fontFamily: 'Poppins_700Bold',
  },
  earningsBadge: {
    backgroundColor: Colors.successBg,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.success + '30',
  },
  earningsText: {
    color: Colors.success,
    fontSize: 14,
    fontFamily: 'Poppins_700Bold',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  stepsContainer: {
    backgroundColor: Colors.card,
    borderRadius: Colors.radius,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  stepLeft: {
    alignItems: 'center',
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleDone: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  stepCircleActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  stepLine: {
    width: 2,
    height: 20,
    backgroundColor: Colors.border,
    marginVertical: 2,
  },
  stepLineDone: {
    backgroundColor: Colors.success,
  },
  stepLabel: {
    color: Colors.textMuted,
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
    paddingTop: 5,
    flex: 1,
  },
  stepLabelActive: {
    color: Colors.primary,
    fontFamily: 'Poppins_600SemiBold',
  },
  stepLabelDone: {
    color: Colors.success,
  },
  section: {
    backgroundColor: Colors.card,
    borderRadius: Colors.radius,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontFamily: 'Poppins_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  placeName: {
    color: Colors.text,
    fontSize: 16,
    fontFamily: 'Poppins_700Bold',
    marginBottom: 3,
  },
  placeAddress: {
    color: Colors.textMuted,
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
    marginBottom: 12,
  },
  contactRow: {
    flexDirection: 'row',
    gap: 10,
  },
  contactBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: Colors.radiusSm,
    borderWidth: 1.5,
    borderColor: Colors.primary + '40',
    backgroundColor: 'rgba(233,30,140,0.06)',
  },
  contactBtnText: {
    color: Colors.primary,
    fontSize: 13,
    fontFamily: 'Poppins_600SemiBold',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  itemQtyBadge: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemQty: {
    color: Colors.secondary,
    fontSize: 13,
    fontFamily: 'Poppins_700Bold',
  },
  itemName: {
    color: Colors.text,
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    flex: 1,
  },
  itemPrice: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontFamily: 'Poppins_600SemiBold',
  },
  subtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: 6,
  },
  subtotalLabel: {
    color: Colors.textMuted,
    fontSize: 13,
    fontFamily: 'Poppins_500Medium',
  },
  subtotalValue: {
    color: Colors.text,
    fontSize: 14,
    fontFamily: 'Poppins_700Bold',
  },
  otpSection: {
    backgroundColor: Colors.card,
    borderRadius: Colors.radiusLg,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: Colors.primary + '40',
    alignItems: 'center',
    gap: 12,
  },
  otpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  otpTitle: {
    color: Colors.text,
    fontSize: 17,
    fontFamily: 'Poppins_700Bold',
  },
  otpSubtitle: {
    color: Colors.textMuted,
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
    textAlign: 'center',
  },
  otpError: {
    color: Colors.error,
    fontSize: 13,
    fontFamily: 'Poppins_500Medium',
    textAlign: 'center',
  },
  successBox: {
    backgroundColor: Colors.successBg,
    borderRadius: Colors.radiusLg,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.success + '40',
    marginBottom: 16,
  },
  successTitle: {
    color: Colors.success,
    fontSize: 20,
    fontFamily: 'Poppins_700Bold',
  },
  successSub: {
    color: Colors.success,
    fontSize: 15,
    fontFamily: 'Poppins_600SemiBold',
  },
  cancelledBox: {
    backgroundColor: Colors.error + '14',
    borderRadius: Colors.radiusLg,
    padding: 20,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.error + '40',
    marginBottom: 16,
  },
  cancelledTitle: {
    color: Colors.error,
    fontSize: 17,
    fontFamily: 'Poppins_700Bold',
  },
  cancelledSub: {
    color: Colors.textMuted,
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
    textAlign: 'center',
  },
  footer: {
    padding: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  advanceBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Colors.radius,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  advanceBtnText: {
    color: '#000',
    fontSize: 16,
    fontFamily: 'Poppins_700Bold',
  },
  advanceBtnDisabled: {
    opacity: 0.6,
  },
  notFoundContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  notFoundText: {
    color: Colors.textMuted,
    fontSize: 16,
    fontFamily: 'Poppins_500Medium',
  },
  backBtn: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: Colors.radius,
    marginTop: 8,
  },
  backBtnText: {
    color: Colors.text,
    fontSize: 15,
    fontFamily: 'Poppins_600SemiBold',
  },
});
