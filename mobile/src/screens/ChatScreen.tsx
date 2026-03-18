/**
 * BIQc Mobile — Chat Screen (SoundBoard)
 * Mobile-first business Q&A with conversation history.
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, KeyboardAvoidingView, Platform, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../theme';
import api from '../lib/api';

type Message = { id: string; role: 'user' | 'assistant'; text: string; timestamp: number };

export default function ChatScreen({ route }: any) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const flatListRef = useRef<FlatList>(null);

  const hydrateConversation = useCallback(async (nextConversationId: string) => {
    const detail = await api.get(`/soundboard/conversations/${nextConversationId}`);
    setConversationId(nextConversationId);
    setMessages((detail.data?.messages || []).map((msg: any, index: number) => ({
      id: `${nextConversationId}-${index}`,
      role: msg.role,
      text: msg.content,
      timestamp: new Date(msg.timestamp || Date.now()).getTime(),
    })));
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      const res = await api.get('/soundboard/conversations');
      const rows = res.data?.conversations || [];
      setConversations(rows);
      if (!conversationId && rows[0]?.id) {
        await hydrateConversation(rows[0].id);
      }
    } catch {
      // Non-fatal on first mobile load
    }
  }, [conversationId, hydrateConversation]);

  useEffect(() => { loadConversations(); }, [loadConversations]);
  useEffect(() => {
    const prompt = route?.params?.prompt;
    if (prompt) setInput(prompt);
  }, [route?.params?.prompt]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInput('');
    setSending(true);

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', text, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);

    try {
      const res = await api.post('/soundboard/chat', {
        message: text,
        conversation_id: conversationId,
      });
      const reply = res.data?.reply || res.data?.response || res.data?.message || 'No response received.';
      const assistantMsg: Message = { id: `a-${Date.now()}`, role: 'assistant', text: reply, timestamp: Date.now() };
      setMessages(prev => [...prev, assistantMsg]);
      if (res.data?.conversation_id) setConversationId(res.data.conversation_id);
      await loadConversations();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      const errorMsg: Message = { id: `e-${Date.now()}`, role: 'assistant', text: 'Unable to connect. Please try again.', timestamp: Date.now() };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setSending(false);
    }
  }, [input, sending, conversationId, loadConversations]);

  const renderMessage = useCallback(({ item }: { item: Message }) => (
    <View style={[styles.msgRow, item.role === 'user' && styles.msgRowUser]}>
      <View style={[styles.msgBubble, item.role === 'user' ? styles.msgUser : styles.msgAssistant]}>
        <Text style={[styles.msgText, item.role === 'user' && { color: '#fff' }]}>{item.text}</Text>
      </View>
    </View>
  ), []);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      {messages.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="chatbubbles-outline" size={48} color={theme.colors.brand + '30'} />
          <Text style={styles.emptyTitle}>BIQc SoundBoard</Text>
          <Text style={styles.emptySubtitle}>Ask anything about your business. SoundBoard uses live business data, profile context, and conversation memory.</Text>
          <View style={styles.promptsGrid}>
            {['What needs my attention this week?', 'How is my cash flow looking?', 'What are my biggest risks right now?', 'Which deals are at risk?'].map(prompt => (
              <TouchableOpacity key={prompt} style={styles.promptChip} onPress={() => { setInput(prompt); }} activeOpacity={0.7}>
                <Text style={styles.promptText}>{prompt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          showsVerticalScrollIndicator={false}
        />
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.historyRail}>
        {conversations.map((conversation) => (
          <TouchableOpacity
            key={conversation.id}
            style={[styles.historyChip, conversationId === conversation.id && styles.historyChipActive]}
            onPress={() => hydrateConversation(conversation.id)}
            activeOpacity={0.7}
          >
            <Text style={styles.historyChipText} numberOfLines={1}>{conversation.title || 'Conversation'}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.inputBar}>
        <TextInput
          style={styles.textInput}
          value={input}
          onChangeText={setInput}
          placeholder="Ask BIQc anything..."
          placeholderTextColor={theme.colors.textMuted}
          multiline
          maxLength={2000}
          onSubmitEditing={sendMessage}
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!input.trim() || sending) && { opacity: 0.3 }]}
          onPress={sendMessage}
          disabled={!input.trim() || sending}
          activeOpacity={0.7}
        >
          <Ionicons name={sending ? 'hourglass' : 'arrow-up'} size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  emptyTitle: { fontFamily: theme.fonts.head, fontSize: 24, color: theme.colors.text, marginTop: 16 },
  emptySubtitle: { fontFamily: theme.fonts.body, fontSize: 14, color: theme.colors.textSecondary, marginTop: 4, textAlign: 'center', lineHeight: 20 },
  promptsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 24, justifyContent: 'center' },
  promptChip: { backgroundColor: theme.colors.bgCard, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, paddingHorizontal: 14, paddingVertical: 10 },
  promptText: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.textSecondary },
  historyRail: { paddingHorizontal: 12, paddingBottom: 8, gap: 8 },
  historyChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: theme.radius.full, backgroundColor: theme.colors.bgCard, borderWidth: 1, borderColor: theme.colors.border, marginRight: 8 },
  historyChipActive: { borderColor: theme.colors.brand, backgroundColor: theme.colors.brandDim },
  historyChipText: { fontFamily: theme.fonts.mono, fontSize: 11, color: theme.colors.textSecondary, maxWidth: 180 },
  messageList: { padding: 16, paddingTop: 60 },
  msgRow: { marginBottom: 12 },
  msgRowUser: { alignItems: 'flex-end' },
  msgBubble: { maxWidth: '85%', borderRadius: theme.radius.lg, padding: 14 },
  msgUser: { backgroundColor: theme.colors.brand, borderBottomRightRadius: 4 },
  msgAssistant: { backgroundColor: theme.colors.bgCard, borderWidth: 1, borderColor: theme.colors.border, borderBottomLeftRadius: 4 },
  msgText: { fontFamily: theme.fonts.body, fontSize: 14, color: theme.colors.textSecondary, lineHeight: 21 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, paddingBottom: Platform.OS === 'ios' ? 28 : 12, backgroundColor: theme.colors.bgCard, borderTopWidth: 1, borderTopColor: theme.colors.border, gap: 8 },
  textInput: { flex: 1, minHeight: 40, maxHeight: 120, backgroundColor: theme.colors.bg, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 14, paddingVertical: 10, fontFamily: theme.fonts.body, fontSize: 14, color: theme.colors.text },
  sendButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.brand, justifyContent: 'center', alignItems: 'center' },
});
