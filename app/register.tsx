import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { AuthBrand } from '@/components/AuthBrand';
import { Colors } from '@/constants/colors';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export default function RegisterScreen() {
  const { registerDriver } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [vehicleType, setVehicleType] = useState('moto');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const sendCode = async () => {
    if (!phone.trim()) {
      setError('Le numéro de téléphone est requis pour recevoir le code.');
      return;
    }
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const response = await api.sendAuthOtp({ phone });
      setCodeSent(true);
      setNotice(response.message || 'Un code de vérification a été envoyé.');
    } catch (err) {
      setError(getApiMessage(err, 'Impossible d’envoyer le code. Vérifiez le numéro et réessayez.'));
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    if (
      !name.trim() ||
      !phone.trim() ||
      !email.trim() ||
      !code.trim() ||
      !vehicleType.trim() ||
      !vehiclePlate.trim() ||
      !nationalId.trim()
    ) {
      setError('Veuillez remplir tous les champs obligatoires.');
      return;
    }
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      await registerDriver({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        password,
        code: code.trim(),
        vehicleType: vehicleType.trim().toLowerCase(),
        vehiclePlate: vehiclePlate.trim().toUpperCase(),
        nationalId: nationalId.trim().toUpperCase(),
        licenseNumber: licenseNumber.trim().toUpperCase() || undefined,
      });
      router.replace('/(tabs)');
    } catch (err) {
      setError(getApiMessage(err, 'Impossible de créer le compte driver.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AuthBrand compact />
        <View style={styles.card}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} disabled={loading}>
            <Ionicons name="arrow-back" size={20} color={Colors.authPinkDark} />
            <Text style={styles.backText}>Connexion</Text>
          </TouchableOpacity>
          <Text style={styles.eyebrow}>INSCRIPTION</Text>
          <Text style={styles.title}>Devenir livreur</Text>
          <Text style={styles.subtitle}>
            Votre compte et votre profil driver sont enregistrés sur Jatek.
          </Text>

          <Field label="Nom complet *" icon="person-outline" value={name} onChangeText={setName} placeholder="Votre nom complet" editable={!loading} />
          <Field label="Numéro de téléphone *" icon="call-outline" value={phone} onChangeText={setPhone} placeholder="+212 6 00 00 00 00" keyboardType="phone-pad" editable={!loading} />
          <Field label="E-mail *" icon="mail-outline" value={email} onChangeText={setEmail} placeholder="votre@email.com" keyboardType="email-address" editable={!loading} />
          <Field label="Type de véhicule *" icon="bicycle-outline" value={vehicleType} onChangeText={setVehicleType} placeholder="moto ou voiture" editable={!loading} />
          <Field label="Plaque d’immatriculation *" icon="car-outline" value={vehiclePlate} onChangeText={setVehiclePlate} placeholder="12345-A-6" autoCapitalize="characters" editable={!loading} />
          <Field label="CIN / pièce d’identité *" icon="card-outline" value={nationalId} onChangeText={setNationalId} placeholder="Votre numéro de pièce" autoCapitalize="characters" editable={!loading} />
          <Field label="Numéro du permis" icon="document-text-outline" value={licenseNumber} onChangeText={setLicenseNumber} placeholder="Optionnel" autoCapitalize="characters" editable={!loading} />
          <Field label="Mot de passe *" icon="lock-closed-outline" value={password} onChangeText={setPassword} placeholder="8 caractères minimum" secureTextEntry editable={!loading} />
          <Field label="Confirmer le mot de passe *" icon="shield-checkmark-outline" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Répétez le mot de passe" secureTextEntry editable={!loading} />

          {codeSent && (
            <Field
              label="Code reçu par SMS / WhatsApp *"
              icon="keypad-outline"
              value={code}
              onChangeText={setCode}
              placeholder="123456"
              keyboardType="phone-pad"
              editable={!loading}
              maxLength={6}
            />
          )}

          {notice && (
            <View style={styles.noticeBox}>
              <Ionicons name="checkmark-circle-outline" size={18} color="#087F61" />
              <Text style={styles.noticeText}>{notice}</Text>
            </View>
          )}
          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={18} color={Colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {!codeSent ? (
            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.disabledButton]}
              onPress={sendCode}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>RECEVOIR LE CODE</Text>}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.disabledButton]}
              onPress={submit}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.primaryText}>S’INSCRIRE COMME LIVREUR</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>
          )}

          {codeSent && (
            <TouchableOpacity style={styles.resendButton} onPress={sendCode} disabled={loading}>
              <Text style={styles.resendText}>Renvoyer un code</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.legal}>Les informations sont transmises uniquement à l’API distante Jatek.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  secureTextEntry,
  autoCapitalize,
  editable,
  maxLength,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'characters';
  editable?: boolean;
  maxLength?: number;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <Ionicons name={icon} size={18} color={Colors.authPink} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9A9AA5"
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          autoCapitalize={autoCapitalize || 'none'}
          editable={editable}
          maxLength={maxLength}
        />
      </View>
    </View>
  );
}

function getApiMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    const data = error.data as { error?: string; message?: string } | null;
    return data?.error || data?.message || error.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.authPaper },
  scroll: { flexGrow: 1, paddingBottom: 30 },
  card: {
    marginHorizontal: 20,
    marginTop: -8,
    padding: 22,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    shadowColor: '#6C183F',
    shadowOpacity: 0.15,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 18 },
  backText: { color: Colors.authPinkDark, fontSize: 12, fontFamily: 'Poppins_600SemiBold' },
  eyebrow: { color: Colors.authPink, fontSize: 11, fontFamily: 'Poppins_700Bold', letterSpacing: 1.4 },
  title: { color: '#17151A', fontSize: 28, lineHeight: 34, fontFamily: 'Poppins_800ExtraBold', marginTop: 4 },
  subtitle: { color: '#777580', fontSize: 13, lineHeight: 19, fontFamily: 'Poppins_400Regular', marginTop: 2, marginBottom: 10 },
  field: { marginTop: 12 },
  label: { color: '#38343D', fontSize: 11, fontFamily: 'Poppins_600SemiBold', marginBottom: 5 },
  inputRow: { minHeight: 49, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#C7C5CC' },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: '#201D24', fontSize: 13, fontFamily: 'Poppins_400Regular', minHeight: 48 },
  noticeBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EAF9F4', borderRadius: 10, padding: 11, marginTop: 16 },
  noticeText: { flex: 1, color: '#087F61', fontSize: 12, fontFamily: 'Poppins_500Medium' },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF0F5', borderRadius: 10, padding: 11, marginTop: 16 },
  errorText: { flex: 1, color: '#B0004F', fontSize: 12, fontFamily: 'Poppins_500Medium' },
  primaryButton: { minHeight: 54, borderRadius: 28, backgroundColor: Colors.authPink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 24 },
  disabledButton: { opacity: 0.65 },
  primaryText: { color: '#FFFFFF', fontSize: 13, fontFamily: 'Poppins_700Bold', letterSpacing: 0.4 },
  resendButton: { alignSelf: 'center', marginTop: 14, padding: 6 },
  resendText: { color: Colors.authPinkDark, fontSize: 12, fontFamily: 'Poppins_600SemiBold' },
  legal: { color: '#9A9AA5', textAlign: 'center', fontSize: 10, lineHeight: 15, fontFamily: 'Poppins_400Regular', marginTop: 20, paddingHorizontal: 28 },
});