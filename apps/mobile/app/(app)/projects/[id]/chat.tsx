import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useSelector } from 'react-redux';
import { io, Socket } from 'socket.io-client';
import { api } from '../../../../src/services/api';
import type { RootState } from '../../../../src/store';

interface ChatMessage {
  _id: string;
  channel: string;
  sender: { _id: string; name: string; email: string } | string;
  body: string;
  createdAt: string;
}

const WS_URL = process.env.EXPO_PUBLIC_WS_URL ?? 'http://localhost:3001';

export default function ProjectChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const token = useSelector((s: RootState) => s.auth.accessToken);
  const userId = useSelector((s: RootState) => s.auth.userId);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const socketRef = useRef<Socket | null>(null);
  const channel = `project:${id}`;
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!token) return;

    // Load history
    api
      .get<{ data: ChatMessage[] }>(`/messages/${encodeURIComponent(channel)}`)
      .then((res) => {
        setMessages(res.data.data.reverse());
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Connect Socket.IO
    const socket = io(WS_URL, { auth: { token }, transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join_channel', channel);
    });

    socket.on('message', (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });

    return () => {
      socket.disconnect();
    };
  }, [token, channel]);

  function sendMessage() {
    const text = inputText.trim();
    if (!text || !socketRef.current?.connected) return;
    socketRef.current.emit('message', { channel, body: text });
    setInputText('');
  }

  function getSenderName(msg: ChatMessage): string {
    if (typeof msg.sender === 'object' && msg.sender) return msg.sender.name;
    return 'Unknown';
  }

  function isOwn(msg: ChatMessage): boolean {
    if (typeof msg.sender === 'object') return msg.sender._id === userId;
    return msg.sender === userId;
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={88}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Project Chat</Text>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          const own = isOwn(item);
          return (
            <View style={[styles.bubble, own ? styles.bubbleOwn : styles.bubbleOther]}>
              {!own && <Text style={styles.senderName}>{getSenderName(item)}</Text>}
              <Text style={own ? styles.bodyOwn : styles.bodyOther}>{item.body}</Text>
              <Text style={styles.timestamp}>
                {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>No messages yet. Start the conversation!</Text>
        }
      />

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type a message…"
          placeholderTextColor="#9CA3AF"
          multiline
          maxLength={1000}
          returnKeyType="send"
          onSubmitEditing={sendMessage}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={!inputText.trim()}
          accessibilityLabel="Send message"
        >
          <Text style={styles.sendBtnText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  list: { padding: 16, flexGrow: 1 },
  empty: { textAlign: 'center', color: '#9CA3AF', marginTop: 40 },
  bubble: {
    maxWidth: '80%',
    marginBottom: 12,
    borderRadius: 12,
    padding: 10,
  },
  bubbleOwn: { alignSelf: 'flex-end', backgroundColor: '#2563EB' },
  bubbleOther: { alignSelf: 'flex-start', backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB' },
  senderName: { fontSize: 11, fontWeight: '600', color: '#6B7280', marginBottom: 2 },
  bodyOwn: { fontSize: 15, color: '#fff' },
  bodyOther: { fontSize: 15, color: '#111827' },
  timestamp: { fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 4, textAlign: 'right' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: '#F3F4F6',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
  },
  sendBtn: {
    height: 44,
    paddingHorizontal: 16,
    backgroundColor: '#2563EB',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#93C5FD' },
  sendBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
