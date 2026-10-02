import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/colors';

export function AuthBrand({ compact = false }: { compact?: boolean }) {
  return (
    <View style={[styles.hero, compact && styles.heroCompact]}>
      <Image
        source={require('../assets/logo.png')}
        style={[styles.logo, compact && styles.logoCompact]}
        resizeMode="cover"
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
    backgroundColor: Colors.brandPink,
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
    borderRadius: 22,
    marginBottom: 10,
  },
  logoCompact: {
    width: 96,
    height: 96,
    borderRadius: 16,
    marginBottom: 7,
  },
  driver: {
    color: Colors.primaryDark,
    fontSize: 11,
    fontFamily: 'Poppins_700Bold',
    letterSpacing: 2,
  },
  tagline: {
    color: Colors.primaryDark,
    fontSize: 13,
    fontFamily: 'Poppins_500Medium',
    marginTop: 10,
    textAlign: 'center',
  },
});