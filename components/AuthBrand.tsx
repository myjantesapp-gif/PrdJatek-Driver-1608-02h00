import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

export function AuthBrand({ compact = false }: { compact?: boolean }) {
  return (
    <View style={[styles.hero, compact && styles.heroCompact]}>
      <View style={styles.brandRow}>
        <View style={styles.mark}>
          <Ionicons name="car-sport" size={compact ? 22 : 28} color={Colors.authPink} />
        </View>
        <View>
          <Text style={[styles.wordmark, compact && styles.wordmarkCompact]}>Jatek</Text>
          <Text style={styles.driver}>JATEK DRIVER</Text>
        </View>
      </View>
      {!compact && (
        <Text style={styles.tagline}>Livrez simplement. Avancez sereinement.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: Colors.authPink,
    paddingHorizontal: 24,
    paddingTop: 44,
    paddingBottom: 34,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  heroCompact: {
    paddingTop: 26,
    paddingBottom: 22,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mark: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    color: '#FFFFFF',
    fontSize: 38,
    lineHeight: 40,
    fontFamily: 'Poppins_800ExtraBold',
    letterSpacing: -1.5,
  },
  wordmarkCompact: {
    fontSize: 28,
    lineHeight: 30,
  },
  driver: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'Poppins_700Bold',
    letterSpacing: 2,
  },
  tagline: {
    color: '#FFE2F0',
    fontSize: 13,
    fontFamily: 'Poppins_500Medium',
    marginTop: 22,
  },
});