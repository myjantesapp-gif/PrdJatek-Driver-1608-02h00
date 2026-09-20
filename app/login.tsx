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
import { useAuth } from '@/context/AuthContext';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Veuillez remplir tous les champs.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Identifiants incorrects. Veuillez réessayer.');
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
        <AuthBrand />
        <View style={styles.card}>
          <Text style={styles.eyebrow}>AUTHENTIFICATION</Text>
          <Text style={styles.title}>Connexion</Text>
          <Text style={styles.subtitle}>Accédez à votre espace livreur</Text>

          <AuthField
            label="E-mail"
            icon="mail-outline"
            value={email}
            onChangeText={setEmail}
            placeholder="votre@email.com"
            keyboardType="email-address"
            editable={!loading}
          />

          <AuthField
            label="Mot de passe"
            icon="lock-closed-outline"
            value={password}
            onChangeText={setPassword}
            placeholder="Votre mot de passe"
            secureTextEntry={!showPassword}
            editable={!loading}
            suffix={
              <TouchableOpacity
                onPress={() => setShowPassword((value) => !value)}
                hitSlop={10}
                accessibilityLabel={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={Colors.textMuted}
                />
              </TouchableOpacity>
            }
          />

          <TouchableOpacity
            style={styles.forgotButton}
            onPress={() => router.push('/forgot-password')}
            disabled={loading}
          >
            <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
          </TouchableOpacity>

          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={18} color={Colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.disabledButton]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.primaryText}>S’AUTHENTIFIER</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.registerPrompt}>
          <Text style={styles.promptText}>Vous êtes livreur ?</Text>
          <TouchableOpacity onPress={() => router.push('/register')} disabled={loading}>
            <Text style={styles.registerLink}>Créer un compte driver</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.legal}>Jatek Driver · Confidentialité · Conditions générales</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function AuthField({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  secureTextEntry,
  editable,
  suffix,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  secureTextEntry?: boolean;
  editable?: boolean;
  suffix?: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <Ionicons name={icon} size={19} color={Colors.authPink} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9A9AA5"
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          autoCapitalize="none"
          editable={editable}
        />
        {suffix}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.authPaper,
  },
  scroll: {
    flexGrow: 1,
    paddingBottom: 28,
  },
  card: {
    marginHorizontal: 20,
    marginTop: -12,
    padding: 22,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    shadowColor: '#6C183F',
    shadowOpacity: 0.15,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  eyebrow: {
    color: Colors.authPink,
    fontSize: 11,
    fontFamily: 'Poppins_700Bold',
    letterSpacing: 1.4,
  },
  title: {
    color: '#17151A',
    fontSize: 28,
    lineHeight: 34,
    fontFamily: 'Poppins_800ExtraBold',
    marginTop: 4,
  },
  subtitle: {
    color: '#777580',
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
    marginTop: 2,
    marginBottom: 16,
  },
  field: {
    marginTop: 13,
  },
  label: {
    color: '#38343D',
    fontSize: 12,
    fontFamily: 'Poppins_600SemiBold',
    marginBottom: 6,
  },
  inputRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#C7C5CC',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#201D24',
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    minHeight: 50,
  },
  forgotButton: {
    alignSelf: 'flex-end',
    marginTop: 12,
  },
  forgotText: {
    color: Colors.authPinkDark,
    fontSize: 12,
    fontFamily: 'Poppins_600SemiBold',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF0F5',
    borderRadius: 10,
    padding: 11,
    marginTop: 14,
  },
  errorText: {
    flex: 1,
    color: '#B0004F',
    fontSize: 12,
    fontFamily: 'Poppins_500Medium',
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 28,
    backgroundColor: Colors.authPink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginTop: 24,
  },
  disabledButton: {
    opacity: 0.65,
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Poppins_700Bold',
    letterSpacing: 0.6,
  },
  registerPrompt: {
    alignItems: 'center',
    marginTop: 24,
    gap: 4,
  },
  promptText: {
    color: '#777580',
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
  },
  registerLink: {
    color: Colors.authPinkDark,
    fontSize: 13,
    fontFamily: 'Poppins_700Bold',
  },
  legal: {
    color: '#9A9AA5',
    textAlign: 'center',
    fontSize: 10,
    fontFamily: 'Poppins_400Regular',
    marginTop: 24,
    paddingHorizontal: 22,
  },
});