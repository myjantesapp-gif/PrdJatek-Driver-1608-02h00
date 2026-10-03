import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useDriver } from '@/context/DriverContext';
import { useAuth } from '@/context/AuthContext';
import { EarningsCard } from '@/components/EarningsCard';
import { MetricsSyncStatus } from '@/components/MetricsSyncStatus';
import { StatusToggle } from '@/components/StatusToggle';
import { OrderCard } from '@/components/OrderCard';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { status, setStatus, earnings, stats, profile, activeOrder } = useDriver();

  const toggleStatus = () => {
    if (status === 'busy') return;
    setStatus(status === 'online' ? 'offline' : 'online');
  };

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : 0;

  return (
    <View style={[styles.container, { paddingTop: topPad, paddingBottom: botPad }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.headerRow}>
          <View style={styles.identity}>
            <Image
              source={require('../../assets/jatek-logo-transparent.png')}
              style={styles.brandMark}
              resizeMode="contain"
              accessibilityLabel="Jatek"
            />
            <View style={styles.driverIdentity}>
              <Text style={styles.greeting}>Bonjour,</Text>
              <Text style={styles.driverName} numberOfLines={1}>{profile.name.split(' ')[0]}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.supportBtn} onPress={() => router.push('/support')}>
            <Ionicons name="headset" size={21} color={Colors.text} />
          </TouchableOpacity>
        </View>

        <StatusToggle
          status={status}
          onToggle={toggleStatus}
          disabled={status === 'busy'}
        />

        <View style={styles.sectionGap} />

        {activeOrder && (
          <>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.activePulse} />
                <Text style={styles.sectionTitle}>À faire maintenant</Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push(`/order/${activeOrder.id}`)}
                style={styles.continueLink}
                activeOpacity={0.75}
              >
                <Text style={styles.seeAll}>Reprendre</Text>
                <Ionicons name="arrow-forward" size={14} color={Colors.primaryDark} />
              </TouchableOpacity>
            </View>
            <OrderCard
              order={activeOrder}
              onPress={() => router.push(`/order/${activeOrder.id}`)}
            />
            <View style={styles.sectionGap} />
          </>
        )}

        <EarningsCard earnings={earnings} stats={stats} />
        <MetricsSyncStatus />

        <View style={styles.sectionGap} />

        <View style={styles.quickActions}>
          <Text style={styles.sectionTitle}>Accès rapide</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/support')} activeOpacity={0.8}>
              <View style={[styles.actionIcon, { backgroundColor: '#E3F2EF' }]}>
                <Ionicons name="headset" size={23} color={Colors.tertiary} />
              </View>
              <Text style={styles.actionLabel}>Support</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/map')} activeOpacity={0.8}>
              <View style={[styles.actionIcon, { backgroundColor: '#E3F2EF' }]}>
                <Ionicons name="navigate" size={23} color={Colors.tertiary} />
              </View>
              <Text style={styles.actionLabel}>Navigation</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/history')} activeOpacity={0.8}>
              <View style={[styles.actionIcon, { backgroundColor: '#F8F0D9' }]}>
                <Ionicons name="time" size={24} color={Colors.secondary} />
              </View>
              <Text style={styles.actionLabel}>Historique</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/profile')} activeOpacity={0.8}>
              <View style={[styles.actionIcon, { backgroundColor: '#FCE4EF' }]}>
                <Ionicons name="person" size={24} color={Colors.primary} />
              </View>
              <Text style={styles.actionLabel}>Profil</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.vehicleCard}>
          <MaterialCommunityIcons name="motorbike" size={22} color={Colors.secondary} />
          <View style={styles.vehicleInfo}>
            <Text style={styles.vehiclePlate}>{profile.vehiclePlate}</Text>
            <Text style={styles.vehicleType}>{profile.vehicleType}</Text>
          </View>
          <View style={styles.docsOk}>
            <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
            <Text style={styles.docsText}>Documents OK</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    paddingTop: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    flex: 1,
  },
  brandMark: {
    width: 48,
    height: 48,
  },
  driverIdentity: {
    flex: 1,
  },
  greeting: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
  },
  driverName: {
    color: Colors.text,
    fontSize: 23,
    fontFamily: 'Poppins_700Bold',
    letterSpacing: -0.3,
  },
  supportBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.tertiaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.tertiaryLight,
  },
  sectionGap: {
    height: 22,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  continueLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 40,
    paddingLeft: 8,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activePulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 17,
    fontFamily: 'Poppins_700Bold',
  },
  seeAll: {
    color: Colors.primaryDark,
    fontSize: 13,
    fontFamily: 'Poppins_600SemiBold',
  },
  quickActions: {
    marginBottom: 20,
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 12,
  },
  actionCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: Colors.radius,
    paddingVertical: 14,
    paddingHorizontal: 5,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    color: Colors.text,
    fontSize: 10,
    fontFamily: 'Poppins_600SemiBold',
    textAlign: 'center',
  },
  vehicleCard: {
    backgroundColor: Colors.card,
    borderRadius: Colors.radius,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  vehicleInfo: {
    flex: 1,
  },
  vehiclePlate: {
    color: Colors.text,
    fontSize: 16,
    fontFamily: 'Poppins_700Bold',
    letterSpacing: 1,
  },
  vehicleType: {
    color: Colors.textMuted,
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
  },
  docsOk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  docsText: {
    color: Colors.success,
    fontSize: 12,
    fontFamily: 'Poppins_600SemiBold',
  },
});
