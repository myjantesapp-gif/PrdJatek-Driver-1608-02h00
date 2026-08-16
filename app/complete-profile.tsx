import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useDriver } from '@/context/DriverContext';

export default function CompleteProfileScreen() {
  const { user } = useAuth();
  const { refreshProfile } = useDriver();
  const [vehicleType, setVehicleType] = useState('moto');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!user?.driverId) return;
    if (vehicleType.trim().length < 2 || vehiclePlate.trim().length < 3 || nationalId.trim().length < 4) {
      setError('Renseignez le type de véhicule, une plaque valide et votre pièce d’identité.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await api.completeDriverProfile(user.driverId, {
        vehicleType: vehicleType.trim(),
        vehiclePlate: vehiclePlate.trim(),
        nationalId: nationalId.trim(),
        licenseNumber: licenseNumber.trim() || undefined,
      });
      await refreshProfile();
      Alert.alert('Profil complété', 'Vous pouvez maintenant accepter des livraisons.', [
        { text: 'Continuer', onPress: () => router.replace('/(tabs)') },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de compléter le profil.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
          <Ionicons name="close" size={22} color={Colors.text} />
        </TouchableOpacity>

        <View style={styles.iconCircle}>
          <Ionicons name="document-text-outline" size={30} color={Colors.primary} />
        </View>
        <Text style={styles.title}>Compléter votre profil</Text>
        <Text style={styles.subtitle}>
          Ces informations sont obligatoires avant d’accepter une livraison.
        </Text>

        <Field
          label="Type de véhicule"
          value={vehicleType}
          onChangeText={setVehicleType}
          placeholder="moto, voiture…"
          autoCapitalize="none"
        />
        <Field
          label="Plaque d’immatriculation"
          value={vehiclePlate}
          onChangeText={setVehiclePlate}
          placeholder="12345-A-6"
          autoCapitalize="characters"
        />
        <Field
          label="Numéro de pièce d’identité"
          value={nationalId}
          onChangeText={setNationalId}
          placeholder="Votre CIN"
          autoCapitalize="characters"
        />
        <Field
          label="Numéro de permis (optionnel)"
          value={licenseNumber}
          onChangeText={setLicenseNumber}
          placeholder="Votre permis"
          autoCapitalize="characters"
        />

        {error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={18} color={Colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.submitButton, loading && styles.disabledButton]}
          onPress={submit}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <>
              <Text style={styles.submitText}>Enregistrer mon profil</Text>
              <Ionicons name="arrow-forward" size={18} color="#000" />
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  autoCapitalize?: 'none' | 'characters';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        autoCapitalize={autoCapitalize}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flexGrow: 1,
    padding: 24,
    paddingTop: Platform.OS === 'web' ? 64 : 24,
  },
  closeButton: {
    alignSelf: 'flex-end',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    marginBottom: 28,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(233,30,140,0.12)',
    borderWidth: 1,
    borderColor: Colors.primary + '40',
    marginBottom: 18,
  },
  title: {
    color: Colors.text,
    fontSize: 26,
    fontFamily: 'Poppins_800ExtraBold',
    marginBottom: 8,
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: 'Poppins_400Regular',
    marginBottom: 28,
  },
  field: {
    gap: 7,
    marginBottom: 16,
  },
  label: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontFamily: 'Poppins_600SemiBold',
  },
  input: {
    height: 50,
    borderRadius: Colors.radiusSm,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    color: Colors.text,
    paddingHorizontal: 14,
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
  },
  errorBox: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    padding: 12,
    borderRadius: Colors.radiusSm,
    backgroundColor: Colors.errorBg,
    borderWidth: 1,
    borderColor: Colors.error + '40',
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    color: Colors.error,
    fontSize: 13,
    fontFamily: 'Poppins_500Medium',
  },
  submitButton: {
    height: 54,
    borderRadius: Colors.radius,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  disabledButton: {
    opacity: 0.7,
  },
  submitText: {
    color: '#000',
    fontSize: 15,
    fontFamily: 'Poppins_700Bold',
  },
});