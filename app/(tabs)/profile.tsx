import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useDriver } from '@/context/DriverContext';
import { useAuth } from '@/context/AuthContext';
import { router } from 'expo-router';

function ProfileRow({ icon, label, value, color, onPress }: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value?: string;
  color?: string;
  onPress?: () => void;
}) {
  const inner = (
    <>
      <View style={[styles.rowIcon, { backgroundColor: (color ?? Colors.primary) + '18' }]}>
        <Ionicons name={icon} size={20} color={color ?? Colors.primary} />
      </View>
      <View style={styles.rowInfo}>
        <Text style={styles.rowLabel}>{label}</Text>
        {!!value && <Text style={styles.rowValue}>{value}</Text>}
      </View>
      {!!onPress && <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />}
    </>
  );
  if (onPress) {
    return (
      <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
        {inner}
      </TouchableOpacity>
    );
  }
  return <View style={styles.row}>{inner}</View>;
}

const LEVEL_COLORS: Record<string, string> = {
  Bronze: '#CD7F32',
  Silver: '#C0C0C0',
  Gold: Colors.secondary,
  Platinum: Colors.tertiary,
};

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const {
    profile,
    stats,
    earnings,
    isApiConnected,
    isSocketConnected,
    lastSyncAt,
    pushNotificationStatus,
  } = useDriver();
  const { logout } = useAuth();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : 0;
  const levelColor = LEVEL_COLORS[stats.level] ?? Colors.secondary;

  const handleLogout = () => {
    Alert.alert(
      'Déconnexion',
      'Êtes-vous sûr de vouloir vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Déconnecter', style: 'destructive', onPress: () => logout() },
      ],
    );
  };

  return (
    <View style={[styles.container, { paddingTop: topPad, paddingBottom: botPad }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Profil</Text>
          <TouchableOpacity style={styles.supportBtn} onPress={() => router.push('/support')}>
            <Ionicons name="help-circle-outline" size={24} color={Colors.tertiary} />
          </TouchableOpacity>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={40} color={Colors.primary} />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{profile.name}</Text>
            <Text style={styles.profileId}>ID: {profile.id}</Text>
          </View>
          <View style={[styles.levelBadge, { borderColor: levelColor + '50', backgroundColor: levelColor + '18' }]}>
            <Ionicons name="star" size={13} color={levelColor} />
            <Text style={[styles.levelText, { color: levelColor }]}>{stats.level}</Text>
          </View>
        </View>

        <View style={styles.ratingCard}>
          <View style={styles.ratingMain}>
            <Text style={styles.ratingBig}>{stats.rating.toFixed(2)}</Text>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Ionicons
                  key={s}
                  name={s <= Math.round(stats.rating) ? 'star' : 'star-outline'}
                  size={18}
                  color={Colors.secondary}
                />
              ))}
            </View>
            <Text style={styles.ratingLabel}>Note générale</Text>
          </View>
          <View style={styles.ratingDivider} />
          <View style={styles.ratingStats}>
            <View style={styles.ratingStat}>
              <Text style={styles.ratingStatVal}>{stats.deliveriesTotal}</Text>
              <Text style={styles.ratingStatLabel}>Livraisons</Text>
            </View>
            <View style={styles.ratingStat}>
              <Text style={[styles.ratingStatVal, { color: Colors.success }]}>
                {earnings.month.toFixed(0)} €
              </Text>
              <Text style={styles.ratingStatLabel}>Ce mois</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Informations</Text>
        <View style={styles.section}>
          <ProfileRow
            icon="call-outline"
            label="Téléphone"
            value={profile.phone}
            color={Colors.tertiary}
          />
          <View style={styles.separator} />
          <ProfileRow
            icon="car-outline"
            label="Véhicule"
            value={profile.vehicleType}
            color={Colors.secondary}
          />
          <View style={styles.separator} />
          <ProfileRow
            icon="id-card-outline"
            label="Plaque"
            value={profile.vehiclePlate}
            color={Colors.secondary}
          />
        </View>

        <Text style={styles.sectionLabel}>Documents</Text>
        <View style={styles.section}>
          {/* Show "pending" when the driver hasn't completed their profile yet */}
          <DocumentRow label="Permis de conduire" status={profile.vehiclePlate ? 'valid' : 'pending'} />
          <View style={styles.separator} />
          <DocumentRow label="Assurance véhicule" status={profile.vehiclePlate ? 'valid' : 'pending'} />
          <View style={styles.separator} />
          <DocumentRow label="Carte grise" status={profile.vehiclePlate ? 'valid' : 'pending'} />
          <View style={styles.separator} />
          <DocumentRow label="Carte d'identité" status={profile.vehiclePlate ? 'valid' : 'pending'} />
        </View>

        <Text style={styles.sectionLabel}>Paramètres</Text>
        <View style={styles.section}>
          <ProfileRow
            icon="key-outline"
            label="Changer le mot de passe"
            color={Colors.secondary}
            onPress={() => router.push('/change-password')}
          />
          <View style={styles.separator} />
          <ProfileRow
            icon="headset-outline"
            label="Support"
            color={Colors.tertiary}
            onPress={() => router.push('/support')}
          />
          <View style={styles.separator} />
          <ProfileRow
            icon="notifications-outline"
            label="Notifications"
            color={Colors.primary}
            onPress={() => router.push('/notifications')}
          />
          <View style={styles.separator} />
          <ProfileRow
            icon="shield-outline"
            label="Confidentialité"
            color={Colors.textMuted}
            onPress={() => router.push('/privacy')}
          />
        </View>

        {/* Connection status */}
        <View style={styles.apiStatus}>
          <View style={[styles.apiDot, { backgroundColor: isApiConnected ? Colors.success : Colors.error }]} />
          <Text style={styles.apiStatusText}>
            {isApiConnected
              ? `API connectée${lastSyncAt ? ` · ${lastSyncAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : ''}`
              : 'API non connectée'}
          </Text>
        </View>
        <View style={[styles.apiStatus, { marginTop: 4 }]}>
          <View style={[styles.apiDot, { backgroundColor: isSocketConnected ? Colors.success : Colors.warning ?? '#F59E0B' }]} />
          <Text style={styles.apiStatusText}>
             {isSocketConnected ? 'Commandes en temps réel (Socket.IO)' : 'Temps réel en attente de connexion…'}
          </Text>
        </View>
        <View style={[styles.apiStatus, { marginTop: 4 }]}>
          <View
            style={[
              styles.apiDot,
              {
                backgroundColor: pushNotificationStatus === 'enabled'
                  ? Colors.success
                  : pushNotificationStatus === 'sync-error'
                    ? Colors.error
                    : Colors.warning ?? '#F59E0B',
              },
            ]}
          />
          <Text style={styles.apiStatusText}>
            {pushNotificationStatus === 'enabled'
              ? 'Notifications push activées'
              : pushNotificationStatus === 'permission-denied'
                ? 'Notifications push désactivées · activez-les dans les réglages'
                : pushNotificationStatus === 'sync-error'
                  ? 'Token push refusé par le serveur'
                  : pushNotificationStatus === 'unavailable'
                    ? 'Notifications push indisponibles sur cet appareil'
                    : 'Notifications push en préparation…'}
          </Text>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color={Colors.error} />
          <Text style={styles.logoutText}>Déconnexion</Text>
        </TouchableOpacity>

        <View style={styles.appInfo}>
          <Text style={styles.appVersion}>Jatek Driver v1.0.0</Text>
          <Text style={styles.appSub}>Votre partenaire de livraison</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function DocumentRow({ label, status }: { label: string; status: 'valid' | 'expired' | 'pending' }) {
  const config = {
    valid: { color: Colors.success, icon: 'checkmark-circle' as const, label: 'Valide' },
    expired: { color: Colors.error, icon: 'close-circle' as const, label: 'Expiré' },
    pending: { color: Colors.warning, icon: 'time' as const, label: 'En attente' },
  };
  const c = config[status];
  return (
    <View style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: Colors.surface }]}>
        <Ionicons name="document-text-outline" size={20} color={Colors.textSecondary} />
      </View>
      <Text style={[styles.rowInfo, { flex: 1 }]}>{label}</Text>
      <View style={styles.docStatus}>
        <Ionicons name={c.icon} size={16} color={c.color} />
        <Text style={[styles.docStatusText, { color: c.color }]}>{c.label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    color: Colors.text,
    fontSize: 28,
    fontFamily: 'Poppins_800ExtraBold',
    letterSpacing: -0.5,
  },
  supportBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  profileCard: {
    backgroundColor: Colors.card,
    borderRadius: Colors.radiusLg,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(233,30,140,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.primary + '40',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    color: Colors.text,
    fontSize: 18,
    fontFamily: 'Poppins_700Bold',
    marginBottom: 2,
  },
  profileId: {
    color: Colors.textMuted,
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  levelText: {
    fontSize: 12,
    fontFamily: 'Poppins_700Bold',
  },
  ratingCard: {
    backgroundColor: Colors.card,
    borderRadius: Colors.radiusLg,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  ratingMain: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  ratingBig: {
    color: Colors.text,
    fontSize: 36,
    fontFamily: 'Poppins_800ExtraBold',
  },
  stars: {
    flexDirection: 'row',
    gap: 2,
  },
  ratingLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
  },
  ratingDivider: {
    width: 1,
    height: 60,
    backgroundColor: Colors.border,
    marginHorizontal: 16,
  },
  ratingStats: {
    flex: 1,
    gap: 16,
  },
  ratingStat: {
    alignItems: 'center',
  },
  ratingStatVal: {
    color: Colors.text,
    fontSize: 20,
    fontFamily: 'Poppins_800ExtraBold',
  },
  ratingStatLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
  },
  sectionLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontFamily: 'Poppins_500Medium',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 8,
    marginLeft: 4,
  },
  section: {
    backgroundColor: Colors.card,
    borderRadius: Colors.radius,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 14,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowInfo: {
    flex: 1,
    color: Colors.text,
    fontSize: 14,
    fontFamily: 'Poppins_500Medium',
  },
  rowLabel: {
    color: Colors.text,
    fontSize: 14,
    fontFamily: 'Poppins_500Medium',
    marginBottom: 1,
  },
  rowValue: {
    color: Colors.textMuted,
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
  },
  separator: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 68,
  },
  docStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  docStatusText: {
    fontSize: 12,
    fontFamily: 'Poppins_600SemiBold',
  },
  apiStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  apiDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  apiStatusText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.errorBg,
    borderRadius: Colors.radius,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.error + '30',
    marginBottom: 24,
  },
  logoutText: {
    color: Colors.error,
    fontSize: 15,
    fontFamily: 'Poppins_600SemiBold',
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: 8,
    gap: 4,
  },
  appVersion: {
    color: Colors.textMuted,
    fontSize: 12,
    fontFamily: 'Poppins_500Medium',
  },
  appSub: {
    color: Colors.textMuted,
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
  },
});
