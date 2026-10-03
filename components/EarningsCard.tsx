import { formatMAD } from '@/lib/money';
import { formatRemoteNumber } from '@/lib/driver-metrics';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
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
      </View>

      <Text style={styles.amount}>{formatMAD(earnings.today)}</Text>

      <View style={styles.statsRow}>
        <View style={styles.statCol}>
          <Text style={styles.statValue}>{formatRemoteNumber(stats.deliveriesToday)}</Text>
          <Text style={styles.statLabel}>Livraisons</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statCol}>
          <Text style={styles.statValue}>{formatRemoteNumber(stats.deliveriesTotal)}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statCol}>
          <Text style={[styles.statValue, styles.ratingValue]}>
            {formatRemoteNumber(stats.rating, 2)}
          </Text>
          <Text style={styles.statLabel}>Note</Text>
        </View>
      </View>

      <View style={styles.weekRow}>
        <View style={styles.weekItem}>
          <Text style={styles.weekLabel}>Cette semaine</Text>
          <Text style={styles.weekAmount}>{formatMAD(earnings.week)}</Text>
        </View>
        <View style={styles.weekItem}>
          <Text style={styles.weekLabel}>Ce mois</Text>
          <Text style={styles.weekAmount}>{formatMAD(earnings.month)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.text,
    borderRadius: Colors.radiusLg,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.text,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    color: '#C5D8D5',
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
    color: Colors.card,
    fontSize: 38,
    fontFamily: 'Poppins_700Bold',
    marginBottom: 19,
    letterSpacing: -1,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,253,249,0.12)',
    borderRadius: Colors.radiusSm,
    padding: 14,
    marginBottom: 14,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    color: Colors.card,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 2,
  },
  ratingValue: {
    color: Colors.secondaryLight,
  },
  statLabel: {
    color: '#C5D8D5',
    fontSize: 11,
    fontWeight: '500',
  },
  divider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,253,249,0.2)',
  },
  weekRow: {
    flexDirection: 'row',
    gap: 12,
  },
  weekItem: {
    flex: 1,
    backgroundColor: 'rgba(255,253,249,0.12)',
    borderRadius: Colors.radiusSm,
    padding: 12,
  },
  weekLabel: {
    color: '#C5D8D5',
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 4,
  },
  weekAmount: {
    color: Colors.tertiaryLight,
    fontSize: 16,
    fontWeight: '700',
  },
});
