import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/colors';

export function AuthBrand({ compact = false }: { compact?: boolean }) {
  return (
    <View style={[styles.hero, compact && styles.heroCompact]}>
      <Image
        source={require('../assets/jatek-logo-transparent.png')}
        style={[styles.logo, compact && styles.logoCompact]}
        resizeMode="contain"
        accessibilityLabel="Logo Jatek Driver"
      />
      <Text style={styles.driver}>JATEK DRIVER</Text>
      {!compact && (
        <Text style={styles.tagline}>Livrez simplement. Avancez sereinement.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: Colors.background,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 26,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    alignItems: 'center',
  },
  heroCompact: {
    paddingTop: 20,
    paddingBottom: 18,
  },
  logo: {
    width: 140,
    height: 140,
    marginBottom: 10,
  },
  logoCompact: {
    width: 96,
    height: 96,
    marginBottom: 7,
  },
  driver: {
    color: Colors.text,
    fontSize: 11,
    fontFamily: 'Poppins_700Bold',
    letterSpacing: 2,
  },
  tagline: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontFamily: 'Poppins_500Medium',
    marginTop: 10,
    textAlign: 'center',
  },
});