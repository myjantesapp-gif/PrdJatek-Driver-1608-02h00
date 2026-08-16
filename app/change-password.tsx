import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { api, ApiError } from '@/lib/api';

export default function ChangePasswordScreen() {
  const insets = useSafeAreaInsets();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const newPasswordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

  const handleSubmit = async () => {
    if (!currentPassword.trim()) {
      Alert.alert('Champ manquant', 'Veuillez entrer votre mot de passe actuel.');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Mot de passe trop court', 'Le nouveau mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mots de passe différents', 'Le nouveau mot de passe et la confirmation ne correspondent pas.');
      return;
    }
    if (newPassword === currentPassword) {
      Alert.alert('Mot de passe identique', 'Le nouveau mot de passe doit être différent de l\'actuel.');
      return;
    }

    setLoading(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      Alert.alert(
        'Mot de passe modifié',
        'Votre mot de passe a été mis à jour avec succès.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      if (status === 401 || status === 403) {
        Alert.alert('Mot de passe incorrect', 'Le mot de passe actuel est incorrect.');
      } else if (status === 422 || status === 400) {
        const msg = err instanceof ApiError && (err.data as any)?.error;
        Alert.alert('Erreur', msg || 'Le nouveau mot de passe est invalide.');
      } else {
        Alert.alert('Erreur', 'Impossible de modifier le mot de passe. Vérifiez votre connexion et réessayez.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-down" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Changer le mot de passe</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.subtitle}>
            Choisissez un mot de passe fort d'au moins 8 caractères.
          </Text>

          {/* Current password */}
          <Text style={styles.label}>Mot de passe actuel</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="••••••••"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry={!showCurrent}
              autoCapitalize="none"
              returnKeyType="next"
              onSubmitEditing={() => newPasswordRef.current?.focus()}
            />
            <TouchableOpacity onPress={() => setShowCurrent((v) => !v)} style={styles.eyeBtn}>
              <Ionicons
                name={showCurrent ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={Colors.textMuted}
              />
            </TouchableOpacity>
          </View>

          {/* New password */}
          <Text style={styles.label}>Nouveau mot de passe</Text>
          <View style={styles.inputRow}>
            <TextInput
              ref={newPasswordRef}
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Min. 8 caractères"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry={!showNew}
              autoCapitalize="none"
              returnKeyType="next"
              onSubmitEditing={() => confirmPasswordRef.current?.focus()}
            />
            <TouchableOpacity onPress={() => setShowNew((v) => !v)} style={styles.eyeBtn}>
              <Ionicons
                name={showNew ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={Colors.textMuted}
              />
            </TouchableOpacity>
          </View>
          {newPassword.length > 0 && newPassword.length < 8 && (
            <Text style={styles.hint}>Au moins 8 caractères requis</Text>
          )}

          {/* Confirm new password */}
          <Text style={styles.label}>Confirmer le nouveau mot de passe</Text>
          <View style={styles.inputRow}>
            <TextInput
              ref={confirmPasswordRef}
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="••••••••"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry={!showConfirm}
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
            <TouchableOpacity onPress={() => setShowConfirm((v) => !v)} style={styles.eyeBtn}>
              <Ionicons
                name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={Colors.textMuted}
              />
            </TouchableOpacity>
          </View>
          {confirmPassword.length > 0 && newPassword !== confirmPassword && (
            <Text style={styles.hint}>Les mots de passe ne correspondent pas</Text>
          )}

          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            activeOpacity={0.85}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.submitText}>Modifier le mot de passe</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border ?? '#1E1E2E',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: Colors.text,
    fontSize: 17,
    fontFamily: 'Poppins_600SemiBold',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
    marginBottom: 28,
    lineHeight: 20,
  },
  label: {
    color: Colors.text,
    fontSize: 12,
    fontFamily: 'Poppins_600SemiBold',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 20,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card ?? '#12121F',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border ?? '#1E1E2E',
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    color: Colors.text,
    fontSize: 15,
    fontFamily: 'Poppins_400Regular',
    paddingVertical: 14,
  },
  eyeBtn: {
    padding: 4,
  },
  hint: {
    color: Colors.error ?? '#EF4444',
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
    marginTop: 4,
    marginLeft: 4,
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 36,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color: '#000',
    fontSize: 15,
    fontFamily: 'Poppins_700Bold',
  },
});
