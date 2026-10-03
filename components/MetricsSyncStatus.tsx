import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useDriver } from '@/context/DriverContext';
import { Colors } from '@/constants/colors';

export function MetricsSyncStatus() {
  const { metricsRefreshing, metricsSyncError, metricsLastSyncAt, refreshEarnings } = useDriver();
  return (
    <View style={styles.container}>
      <Text accessibilityLiveRegion="polite" style={[styles.text, metricsSyncError && styles.error]}>
        {metricsSyncError
          ? `Chiffres non actualisés : ${metricsSyncError}`
          : metricsRefreshing
            ? 'Synchronisation avec api.jatek.app…'
            : metricsLastSyncAt
              ? `Chiffres du backend · actualisés à ${metricsLastSyncAt.toLocaleTimeString('fr-FR')}`
              : 'Chiffres du backend en attente de synchronisation'}
      </Text>
      {metricsSyncError && metricsLastSyncAt && (
        <Text style={styles.text}>Dernière synchronisation : {metricsLastSyncAt.toLocaleTimeString('fr-FR')}</Text>
      )}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Actualiser les gains et les statistiques depuis le backend"
        disabled={metricsRefreshing}
        onPress={() => { void refreshEarnings(); }}
        style={styles.button}
      >
        {metricsRefreshing
          ? <ActivityIndicator color={Colors.primary} size="small" />
          : <Text style={styles.action}>{metricsSyncError ? 'Réessayer' : 'Actualiser les chiffres'}</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: 10, gap: 6 },
  text: { color: Colors.textMuted, fontSize: 12 },
  error: { color: Colors.error },
  button: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 6 },
  action: { color: Colors.primary, fontSize: 13, fontWeight: '600' },
});