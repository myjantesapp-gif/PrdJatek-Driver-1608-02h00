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
import { ApiError, api } from '@/lib/api';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const requestCode = async () => {
    if (!email.trim()) {
      setError('Saisissez votre adresse e-mail.');
      return;
    }
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const response = await api.requestPasswordReset(email);
      setCodeSent(true);
      setNotice(response.message || 'Si un compte existe, un code a été envoyé.');
    } catch (err) {
      setError(getApiMessage(err, 'Impossible de demander la réinitialisation.'));
    } finally {
      setLoading(false);
    }
  };

  const reset = async () => {
    if (!code.trim() || newPassword.length < 8 || newPassword !== confirmPassword) {
      setError('Vérifiez le code et saisissez deux mots de passe identiques de 8 caractères minimum.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await api.resetPassword(email, code, newPassword);
      router.replace('/login');
    } catch (err) {
      setError(getApiMessage(err, 'Le code est invalide ou le mot de passe ne peut pas être réinitialisé.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <AuthBrand compact />
        <View style={styles.card}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} disabled={loading}>
            <Ionicons name="arrow-back" size={20} color={Colors.authPinkDark} />
            <Text style={styles.backText}>Retour</Text>
          </TouchableOpacity>
          <Text style={styles.eyebrow}>SÉCURITÉ DU COMPTE</Text>
          <Text style={styles.title}>Mot de passe oublié</Text>
          <Text style={styles.subtitle}>
            Recevez un code par e-mail et choisissez un nouveau mot de passe.
          </Text>

          <Text style={styles.label}>E-mail</Text>
          <View style={styles.inputRow}>
            <Ionicons name="mail-outline" size={19} color={Colors.authPink} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="votre@email.com"
              placeholderTextColor="#9A9AA5"
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!codeSent && !loading}
            />
          </View>

          {codeSent && (
            <>
              <Text style={styles.label}>Code reçu</Text>
              <View style={styles.inputRow}>
                <Ionicons name="keypad-outline" size={19} color={Colors.authPink} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={code}
                  onChangeText={setCode}
                  placeholder="123456"
                  placeholderTextColor="#9A9AA5"
                  keyboardType="phone-pad"
                  maxLength={6}
                  editable={!loading}
                />
              </View>
              <Text style={styles.label}>Nouveau mot de passe</Text>
              <View style={styles.inputRow}>
                <Ionicons name="lock-closed-outline" size={19} color={Colors.authPink} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="8 caractères minimum"
                  placeholderTextColor="#9A9AA5"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  editable={!loading}
                />
                <TouchableOpacity onPress={() => setShowPassword((value) => !value)} hitSlop={10}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
              <Text style={styles.label}>Confirmer le mot de passe</Text>
              <View style={styles.inputRow}>
                <Ionicons name="shield-checkmark-outline" size={19} color={Colors.authPink} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Répétez le mot de passe"
                  placeholderTextColor="#9A9AA5"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  editable={!loading}
                />
              </View>
            </>
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

          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.disabledButton]}
            onPress={codeSent ? reset : requestCode}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryText}>{codeSent ? 'RÉINITIALISER LE MOT DE PASSE' : 'ENVOYER LE CODE'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
  subtitle: { color: '#777580', fontSize: 13, lineHeight: 19, fontFamily: 'Poppins_400Regular', marginTop: 2, marginBottom: 18 },
  label: { color: '#38343D', fontSize: 12, fontFamily: 'Poppins_600SemiBold', marginTop: 15, marginBottom: 6 },
  inputRow: { minHeight: 51, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#C7C5CC' },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: '#201D24', fontSize: 14, fontFamily: 'Poppins_400Regular', minHeight: 50 },
  noticeBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EAF9F4', borderRadius: 10, padding: 11, marginTop: 16 },
  noticeText: { flex: 1, color: '#087F61', fontSize: 12, fontFamily: 'Poppins_500Medium' },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF0F5', borderRadius: 10, padding: 11, marginTop: 16 },
  errorText: { flex: 1, color: '#B0004F', fontSize: 12, fontFamily: 'Poppins_500Medium' },
  primaryButton: { minHeight: 54, borderRadius: 28, backgroundColor: Colors.authPink, alignItems: 'center', justifyContent: 'center', marginTop: 24, paddingHorizontal: 16 },
  disabledButton: { opacity: 0.65 },
  primaryText: { color: '#FFFFFF', fontSize: 13, fontFamily: 'Poppins_700Bold', letterSpacing: 0.4, textAlign: 'center' },
});