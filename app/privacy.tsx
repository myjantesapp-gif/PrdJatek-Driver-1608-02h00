import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '@/constants/colors';

export default function PrivacyScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Confidentialité</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.updated}>Politique de confidentialité · Jatek Driver</Text>
        <Section title="Données utilisées">
          L’application utilise les données nécessaires à votre activité de livreur : votre compte,
          votre profil conducteur, vos commandes, votre position lorsque vous êtes en ligne et l’état
          de vos notifications.
        </Section>
        <Section title="Position">
          La position est envoyée exclusivement à l’API distante Jatek afin de permettre le
          suivi des livraisons et la coordination des commandes. Elle n’est pas vendue ni utilisée à
          des fins publicitaires.
        </Section>
        <Section title="Notifications">
          Les notifications servent à vous avertir des nouvelles commandes et des changements
          importants liés à vos livraisons. Vous pouvez gérer l’autorisation dans les réglages de votre
          téléphone. Les commandes live restent synchronisées avec l’API Jatek lorsque vous êtes connecté.
        </Section>
        <Section title="Sécurité et conservation">
          Les échanges avec le backend utilisent HTTPS. Votre session est conservée localement pour
          vous reconnecter automatiquement et peut être supprimée en vous déconnectant.
        </Section>
        <Section title="Vos droits">
          Pour demander une correction ou la suppression de vos données, contactez le support depuis
          l’application ou via votre responsable Jatek.
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 58, paddingBottom: 18 },
  backButton: { width: 40 },
  title: { color: Colors.text, fontSize: 22, fontWeight: '700' },
  content: { padding: 20, paddingTop: 4, paddingBottom: 40 },
  updated: { color: Colors.textMuted, fontSize: 12, marginBottom: 20 },
  section: { backgroundColor: Colors.card, borderRadius: 16, padding: 18, marginBottom: 12 },
  sectionTitle: { color: Colors.text, fontSize: 16, fontWeight: '700', marginBottom: 8 },
  sectionText: { color: Colors.textSecondary, fontSize: 14, lineHeight: 22 },
});