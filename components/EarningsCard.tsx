import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { DriverEarnings, DriverStats } from '@/context/DriverContext';

interface EarningsCardProps {
  earnings: DriverEarnings;
  stats: DriverStats;
}

export function EarningsCard({ earnings, stats }: EarningsCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.label}>Revenus aujourd'hui</Text>
        <View style={styles.levelBadge}>
          <Ionicons name="star" size={12} color={Colors.secondary} />
          <Text style={styles.levelText}>{stats.level}</Text>
        </View>
      </View>

      <Text style={styles.amount}>{earnings.today.toFixed(2)} €</Text>

      <View style={styles.statsRow}>
        <View style={styles.statCol}>
          <Text style={styles.statValue}>{stats.deliveriesToday}</Text>
          <Text style={styles.statLabel}>Livraisons</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statCol}>
          <Text style={styles.statValue}>{stats.kmToday} km</Text>
          <Text style={styles.statLabel}>Parcourus</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statCol}>
          <Text style={[styles.statValue, styles.ratingValue]}>
            {stats.rating.toFixed(2)}
          </Text>
          <Text style={styles.statLabel}>Note</Text>
        </View>
      </View>

      <View style={styles.weekRow}>
        <View style={styles.weekItem}>
          <Text style={styles.weekLabel}>Cette semaine</Text>
          <Text style={styles.weekAmount}>{earnings.week.toFixed(2)} €</Text>
        </View>
        <View style={styles.weekItem}>
          <Text style={styles.weekLabel}>Ce mois</Text>
          <Text style={styles.weekAmount}>{earnings.month.toFixed(2)} €</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Colors.radiusLg,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(200,180,0,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(200,180,0,0.3)',
  },
  levelText: {
    color: Colors.secondary,
    fontSize: 12,
    fontWeight: '700',
  },
  amount: {
    color: Colors.text,
    fontSize: 42,
    fontWeight: '800',
    marginBottom: 20,
    letterSpacing: -1,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Colors.radiusSm,
    padding: 14,
    marginBottom: 14,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 2,
  },
  ratingValue: {
    color: Colors.secondary,
  },
  statLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
  },
  divider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.border,
  },
  weekRow: {
    flexDirection: 'row',
    gap: 12,
  },
  weekItem: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Colors.radiusSm,
    padding: 12,
  },
  weekLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 4,
  },
  weekAmount: {
    color: Colors.tertiary,
    fontSize: 16,
    fontWeight: '700',
  },
});
