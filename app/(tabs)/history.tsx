import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useDriver } from '@/context/DriverContext';
import { DeliveryHistory } from '@/context/DriverContext';

function HistoryItem({ item }: { item: DeliveryHistory }) {
  const date = new Date(item.completedAt);
  const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const dateStr = date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });

  return (
    <View style={styles.item}>
      <View style={styles.itemLeft}>
        <View style={styles.itemIcon}>
          <Ionicons name="checkmark-circle" size={22} color={Colors.success} />
        </View>
        <View style={styles.itemInfo}>
          <Text style={styles.itemRestaurant} numberOfLines={1}>{item.restaurant.name}</Text>
          <Text style={styles.itemCustomer}>{item.customer.name}</Text>
          <View style={styles.itemMeta}>
            <Ionicons name="location-outline" size={12} color={Colors.tertiary} />
            <Text style={styles.itemMetaText}>{item.distance} km</Text>
            <View style={styles.metaDot} />
            <Ionicons name="time-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.itemMetaText}>{timeStr} · {dateStr}</Text>
          </View>
        </View>
      </View>
      <View style={styles.itemRight}>
        <Text style={styles.itemEarnings}>+{item.earnings.toFixed(2)} €</Text>
        {item.rating !== undefined && (
          <View style={styles.ratingRow}>
            {Array.from({ length: item.rating }).map((_, i) => (
              <Ionicons key={i} name="star" size={11} color={Colors.secondary} />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { history, earnings, stats } = useDriver();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : 0;

  const totalEarned = history.reduce((sum, h) => sum + h.earnings, 0);

  return (
    <View style={[styles.container, { paddingTop: topPad, paddingBottom: botPad }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Historique</Text>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{stats.deliveriesTotal}</Text>
          <Text style={styles.summaryLabel}>Total livraisons</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={[styles.summaryValue, { color: Colors.success }]}>
            {earnings.month.toFixed(0)} €
          </Text>
          <Text style={styles.summaryLabel}>Ce mois</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={[styles.summaryValue, { color: Colors.secondary }]}>
            {stats.rating.toFixed(2)}
          </Text>
          <Text style={styles.summaryLabel}>Note moy.</Text>
        </View>
      </View>

      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <HistoryItem item={item as DeliveryHistory} />}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!!history.length}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="time-outline" size={48} color={Colors.border} />
            <Text style={styles.emptyText}>Aucune livraison pour l'instant</Text>
          </View>
        }
        ListHeaderComponent={
          history.length > 0 ? (
            <Text style={styles.sectionTitle}>Livraisons récentes</Text>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
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
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: Colors.radius,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  summaryValue: {
    color: Colors.text,
    fontSize: 20,
    fontFamily: 'Poppins_800ExtraBold',
    marginBottom: 2,
  },
  summaryLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontFamily: 'Poppins_500Medium',
    textAlign: 'center',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 16,
    fontFamily: 'Poppins_700Bold',
    marginBottom: 12,
  },
  item: {
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
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  itemIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.successBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemRestaurant: {
    color: Colors.text,
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
    marginBottom: 1,
  },
  itemCustomer: {
    color: Colors.textMuted,
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
    marginBottom: 4,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  itemMetaText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.border,
  },
  itemRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  itemEarnings: {
    color: Colors.success,
    fontSize: 15,
    fontFamily: 'Poppins_700Bold',
  },
  ratingRow: {
    flexDirection: 'row',
    gap: 2,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
  },
});
