import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Colors } from '@/constants/colors';

interface ChatMessage {
  id: string;
  text: string;
  from: 'driver' | 'support';
  time: string;
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: '1',
    text: 'Bonjour ! Je suis votre assistant Jatek. Comment puis-je vous aider aujourd\'hui ?',
    from: 'support',
    time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
  },
];

const AUTO_REPLIES: Record<string, string> = {
  default: 'Je transmets votre message à un agent. Temps d\'attente estimé : 2 minutes.',
  commande: 'Pour tout problème de commande, veuillez indiquer le numéro de commande. Un agent va vous aider.',
  paiement: 'Les paiements sont traités sous 24-48h. Si votre paiement est en retard, un agent va examiner votre situation.',
  client: 'Pour les litiges avec un client, nous examinons chaque cas individuellement. Décrivez la situation.',
};

const FAQ = [
  { q: 'Quand suis-je payé ?', a: 'Les paiements sont effectués chaque semaine, le lundi.' },
  { q: 'Comment contester une note ?', a: 'Contactez le support via ce chat avec le numéro de commande.' },
  { q: 'Problème avec une commande ?', a: 'Décrivez le problème dans le chat, un agent vous aidera immédiatement.' },
  { q: 'Comment modifier mes infos ?', a: 'Rendez-vous dans votre profil pour modifier vos informations personnelles.' },
];

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isDriver = msg.from === 'driver';
  return (
    <View style={[styles.bubble, isDriver ? styles.bubbleDriver : styles.bubbleSupport]}>
      {!isDriver && (
        <View style={styles.supportAvatar}>
          <Ionicons name="headset" size={14} color={Colors.tertiary} />
        </View>
      )}
      <View style={[styles.bubbleContent, isDriver ? styles.bubbleContentDriver : styles.bubbleContentSupport]}>
        <Text style={[styles.bubbleText, isDriver ? styles.bubbleTextDriver : styles.bubbleTextSupport]}>
          {msg.text}
        </Text>
        <Text style={styles.bubbleTime}>{msg.time}</Text>
      </View>
    </View>
  );
}

export default function SupportScreen() {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [tab, setTab] = useState<'chat' | 'faq'>('chat');
  const flatListRef = useRef<FlatList>(null);
  const replyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up pending reply timer on unmount
  React.useEffect(() => {
    return () => {
      if (replyTimerRef.current) clearTimeout(replyTimerRef.current);
    };
  }, []);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const sendMessage = () => {
    if (!input.trim()) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      text: input.trim(),
      from: 'driver',
      time: now,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    const lower = input.toLowerCase();
    const replyKey = Object.keys(AUTO_REPLIES).find((k) => k !== 'default' && lower.includes(k)) ?? 'default';
    const replyText = AUTO_REPLIES[replyKey];

    if (replyTimerRef.current) clearTimeout(replyTimerRef.current);
    replyTimerRef.current = setTimeout(() => {
      replyTimerRef.current = null;
      const replyMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: replyText,
        from: 'support',
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, replyMsg]);
    }, 1200);
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Support Jatek</Text>
          <View style={styles.onlineRow}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>Agent disponible</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.callBtn}
          onPress={() => Linking.openURL('tel:+33180000000')}
        >
          <Ionicons name="call" size={20} color={Colors.success} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'chat' && styles.tabActive]}
          onPress={() => setTab('chat')}
        >
          <Text style={[styles.tabText, tab === 'chat' && styles.tabTextActive]}>Chat</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'faq' && styles.tabActive]}
          onPress={() => setTab('faq')}
        >
          <Text style={[styles.tabText, tab === 'faq' && styles.tabTextActive]}>FAQ</Text>
        </TouchableOpacity>
      </View>

      {tab === 'chat' ? (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <MessageBubble msg={item} />}
            contentContainerStyle={styles.chatContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            scrollEnabled={!!messages.length}
          />

          <View style={[styles.inputRow, { paddingBottom: botPad + 16 }]}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Écrivez votre message..."
              placeholderTextColor={Colors.textMuted}
              returnKeyType="send"
              onSubmitEditing={sendMessage}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
              onPress={sendMessage}
              disabled={!input.trim()}
            >
              <Ionicons name="send" size={18} color="#000" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      ) : (
        <ScrollView contentContainerStyle={styles.faqContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.faqTitle}>Questions fréquentes</Text>
          {FAQ.map((item, i) => (
            <View key={i} style={styles.faqCard}>
              <View style={styles.faqQuestion}>
                <Ionicons name="help-circle" size={18} color={Colors.primary} />
                <Text style={styles.faqQ}>{item.q}</Text>
              </View>
              <Text style={styles.faqA}>{item.a}</Text>
            </View>
          ))}

          <View style={styles.contactSection}>
            <Text style={styles.contactTitle}>Besoin d'aide urgente ?</Text>
            <TouchableOpacity
              style={styles.phoneBtn}
              onPress={() => Linking.openURL('tel:+33180000000')}
              activeOpacity={0.85}
            >
              <Ionicons name="call" size={20} color="#000" />
              <Text style={styles.phoneBtnText}>+33 1 80 00 00 00</Text>
            </TouchableOpacity>
            <Text style={styles.phoneHours}>Disponible 7j/7 de 8h à 22h</Text>
          </View>
        </ScrollView>
      )}
    </View>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: Colors.text,
    fontSize: 16,
    fontFamily: 'Poppins_700Bold',
  },
  onlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.success,
  },
  onlineText: {
    color: Colors.success,
    fontSize: 11,
    fontFamily: 'Poppins_500Medium',
  },
  callBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.successBg,
    borderWidth: 1,
    borderColor: Colors.success + '40',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
  },
  tabActive: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    color: Colors.textMuted,
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
  },
  tabTextActive: {
    color: '#000',
  },
  chatContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 24,
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 4,
  },
  bubbleDriver: {
    justifyContent: 'flex-end',
  },
  bubbleSupport: {
    justifyContent: 'flex-start',
  },
  supportAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,200,215,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleContent: {
    maxWidth: '75%',
    borderRadius: 16,
    padding: 12,
    gap: 4,
  },
  bubbleContentDriver: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleContentSupport: {
    backgroundColor: Colors.card,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bubbleText: {
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    lineHeight: 20,
  },
  bubbleTextDriver: {
    color: '#fff',
  },
  bubbleTextSupport: {
    color: Colors.text,
  },
  bubbleTime: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    fontFamily: 'Poppins_400Regular',
    alignSelf: 'flex-end',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Colors.radius,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    maxHeight: 100,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  faqContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 12,
  },
  faqTitle: {
    color: Colors.text,
    fontSize: 18,
    fontFamily: 'Poppins_700Bold',
    marginBottom: 4,
  },
  faqCard: {
    backgroundColor: Colors.card,
    borderRadius: Colors.radius,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  faqQuestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  faqQ: {
    color: Colors.text,
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
    flex: 1,
  },
  faqA: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
    lineHeight: 19,
    paddingLeft: 26,
  },
  contactSection: {
    backgroundColor: Colors.card,
    borderRadius: Colors.radiusLg,
    padding: 20,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 8,
  },
  contactTitle: {
    color: Colors.text,
    fontSize: 16,
    fontFamily: 'Poppins_700Bold',
  },
  phoneBtn: {
    backgroundColor: Colors.success,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: Colors.radius,
    width: '100%',
    justifyContent: 'center',
  },
  phoneBtnText: {
    color: '#000',
    fontSize: 16,
    fontFamily: 'Poppins_700Bold',
  },
  phoneHours: {
    color: Colors.textMuted,
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
  },
});
