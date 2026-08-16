import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';
import { DriverStatus } from '@/context/DriverContext';

interface StatusToggleProps {
  status: DriverStatus;
  onToggle: () => void;
  disabled?: boolean;
}

const STATUS_CONFIG = {
  online: { label: 'En ligne', color: Colors.online, icon: 'radio-button-on' as const, bg: Colors.successBg },
  offline: { label: 'Hors ligne', color: Colors.offline, icon: 'radio-button-off' as const, bg: 'rgba(96,96,122,0.12)' },
  busy: { label: 'Occupé', color: Colors.busy, icon: 'ellipse' as const, bg: Colors.warningBg },
};

export function StatusToggle({ status, onToggle, disabled = false }: StatusToggleProps) {
  const config = STATUS_CONFIG[status];
  const pulseAnim = new Animated.Value(1);

  useEffect(() => {
    if (status === 'online') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [status]);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onToggle();
  };

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: config.bg, borderColor: config.color + '40' }]}
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <View style={styles.left}>
        <View style={styles.iconWrap}>
          {status === 'online' && (
            <Animated.View
              style={[styles.pulse, { backgroundColor: Colors.online, transform: [{ scale: pulseAnim }] }]}
            />
          )}
          <Ionicons name={config.icon} size={18} color={config.color} />
        </View>
        <Text style={[styles.label, { color: config.color }]}>{config.label}</Text>
      </View>
      <View style={[styles.pill, { backgroundColor: status === 'online' ? Colors.online : Colors.surface }]}>
        <Text style={[styles.pillText, { color: status === 'online' ? '#000' : Colors.textMuted }]}>
          {status === 'online' ? 'Toucher pour pauser' : 'Toucher pour démarrer'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: Colors.radius,
    borderWidth: 1,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    position: 'relative',
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulse: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    opacity: 0.25,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
