import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  Modal,
  SafeAreaView,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { useSocket } from '../../../src/context/socket.context';
import {
  fetchHistory,
  fetchGroupById,
  addMember,
  removeMember,
  fetchUsers,
} from '../../../src/services/chat.service';
import type { ChatMessage, ChatGroupType } from '@ti/shared';
import type { RootState } from '../../../src/store';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function initials(name?: string) {
  if (!name) return '?';
  return name.split(' ').map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase() || '?';
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateHeader(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function senderName(msg: ChatMessage): string {
  if (typeof msg.sender === 'object' && msg.sender && msg.sender.name) return msg.sender.name;
  return '';
}

function senderId(msg: ChatMessage): string {
  if (typeof msg.sender === 'object' && msg.sender) return msg.sender._id;
  return msg.sender as string;
}

// ─── Group Info Modal ─────────────────────────────────────────────────────────

interface GroupInfoProps {
  visible: boolean;
  onClose: () => void;
  groupId: string;
  groupName: string;
  groupType: ChatGroupType;
  members: { _id: string; name: string; email: string }[];
  currentUserId: string;
  onLeft: () => void;
}

function GroupInfoModal({ visible, onClose, groupId, groupName, groupType, members, currentUserId, onLeft }: GroupInfoProps) {
  const [users, setUsers] = useState<{ _id: string; name: string; email: string }[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const isCustom = groupType === 'custom';

  useEffect(() => {
    if (visible && isCustom) {
      fetchUsers().then(setUsers).catch(() => {});
    }
  }, [visible, isCustom]);

  async function handleAdd(userId: string) {
    setLoading(true);
    try {
      await addMember(groupId, userId);
    } catch {}
    setLoading(false);
    setShowPicker(false);
  }

  function handleLeave() {
    Alert.alert('Leave Group', `Leave "${groupName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          await removeMember(groupId, currentUserId).catch(() => {});
          onClose();
          onLeft();
        },
      },
    ]);
  }

  const nonMembers = users.filter(
    (u) => !members.some((m) => m._id === u._id) && u._id !== currentUserId,
  ).filter((u) => !search || u.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={gi.container}>
        <View style={gi.header}>
          <Text style={gi.title}>{groupName}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="close" size={24} color="#374151" />
          </TouchableOpacity>
        </View>

        <View style={gi.typeBadge}>
          <Ionicons name="people-outline" size={14} color="#6366F1" />
          <Text style={gi.typeBadgeText}>{groupType} group</Text>
        </View>

        <Text style={gi.sectionLabel}>Members ({members.length})</Text>
        {members.map((m) => (
          <View key={m._id} style={gi.memberRow}>
            <View style={gi.avatar}>
              <Text style={gi.avatarText}>{initials(m.name)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={gi.memberName}>{m.name}{m._id === currentUserId ? ' (you)' : ''}</Text>
              <Text style={gi.memberEmail}>{m.email}</Text>
            </View>
          </View>
        ))}

        {isCustom && (
          <View style={gi.actions}>
            {!showPicker ? (
              <TouchableOpacity style={gi.actionBtn} onPress={() => setShowPicker(true)}>
                <Ionicons name="person-add-outline" size={18} color="#6366F1" />
                <Text style={gi.actionBtnText}>Add Member</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ flex: 1 }}>
                <TextInput
                  style={gi.searchInput}
                  placeholder="Search users…"
                  placeholderTextColor="#9CA3AF"
                  value={search}
                  onChangeText={setSearch}
                  autoFocus
                />
                {nonMembers.map((u) => (
                  <TouchableOpacity key={u._id} style={gi.memberRow} onPress={() => handleAdd(u._id)}>
                    <View style={[gi.avatar, { backgroundColor: '#0EA5E9' }]}>
                      <Text style={gi.avatarText}>{initials(u.name)}</Text>
                    </View>
                    <Text style={gi.memberName}>{u.name}</Text>
                    {loading && <ActivityIndicator size="small" />}
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <TouchableOpacity style={[gi.actionBtn, gi.leaveBtn]} onPress={handleLeave}>
              <Ionicons name="exit-outline" size={18} color="#EF4444" />
              <Text style={[gi.actionBtnText, { color: '#EF4444' }]}>Leave Group</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const gi = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', backgroundColor: '#fff' },
  title: { fontSize: 18, fontWeight: '700', color: '#111827' },
  typeBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#EEF2FF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  typeBadgeText: { fontSize: 12, fontWeight: '700', color: '#6366F1', textTransform: 'capitalize' },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', minHeight: 60 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#6366F1', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  memberName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  memberEmail: { fontSize: 12, color: '#9CA3AF' },
  actions: { flex: 1, padding: 16, gap: 10 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', minHeight: 52 },
  leaveBtn: { borderColor: '#FEE2E2' },
  actionBtnText: { fontSize: 14, fontWeight: '600', color: '#6366F1' },
  searchInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: '#111827', marginBottom: 8 },
});

// ─── Message Bubble ───────────────────────────────────────────────────────────

interface BubbleProps {
  msg: ChatMessage;
  isOwn: boolean;
  showSender: boolean;
}

function Bubble({ msg, isOwn, showSender }: BubbleProps) {
  return (
    <View style={[b.wrap, isOwn ? b.wrapOwn : b.wrapOther]}>
      {!isOwn && showSender && (
        <Text style={b.sender}>{senderName(msg)}</Text>
      )}
      <View style={[b.bubble, isOwn ? b.bubbleOwn : b.bubbleOther, msg._sending && b.sending]}>
        <Text style={isOwn ? b.textOwn : b.textOther}>{msg.body}</Text>
        <Text style={[b.time, isOwn ? b.timeOwn : b.timeOther]}>
          {msg._sending ? '…' : formatTime(msg.createdAt ?? new Date().toISOString())}
        </Text>
      </View>
    </View>
  );
}

const b = StyleSheet.create({
  wrap: { marginVertical: 2, paddingHorizontal: 16, maxWidth: '80%' },
  wrapOwn: { alignSelf: 'flex-end' },
  wrapOther: { alignSelf: 'flex-start' },
  sender: { fontSize: 11, fontWeight: '700', color: '#6366F1', marginBottom: 2, marginLeft: 2 },
  bubble: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleOwn: { backgroundColor: '#2563EB', borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderBottomLeftRadius: 4 },
  sending: { opacity: 0.6 },
  textOwn: { fontSize: 15, color: '#fff', lineHeight: 21 },
  textOther: { fontSize: 15, color: '#111827', lineHeight: 21 },
  time: { fontSize: 10, marginTop: 4, textAlign: 'right' },
  timeOwn: { color: 'rgba(255,255,255,0.6)' },
  timeOther: { color: '#9CA3AF' },
});

// ─── Date Header ──────────────────────────────────────────────────────────────

function DateHeader({ date }: { date: string }) {
  return (
    <View style={dh.wrap}>
      <View style={dh.line} />
      <Text style={dh.label}>{date}</Text>
      <View style={dh.line} />
    </View>
  );
}

const dh = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', marginVertical: 12, paddingHorizontal: 16 },
  line: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  label: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', marginHorizontal: 10 },
});

// ─── Mention Picker ───────────────────────────────────────────────────────────

interface MentionPickerProps {
  query: string;
  members: { _id: string; name: string }[];
  onSelect: (name: string) => void;
}

function MentionPicker({ query, members, onSelect }: MentionPickerProps) {
  const filtered = members.filter((m) =>
    m.name.toLowerCase().startsWith(query.toLowerCase()),
  );
  if (filtered.length === 0) return null;
  return (
    <View style={mp.wrap}>
      {filtered.map((m) => (
        <TouchableOpacity key={m._id} style={mp.item} onPress={() => onSelect(m.name)}>
          <Text style={mp.name}>{m.name}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const mp = StyleSheet.create({
  wrap: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E5E7EB', maxHeight: 140 },
  item: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', minHeight: 48 },
  name: { fontSize: 14, fontWeight: '600', color: '#111827' },
});

// ─── Thread Items ─────────────────────────────────────────────────────────────

type ThreadItem =
  | { kind: 'date'; date: string; _id: string }
  | { kind: 'msg'; msg: ChatMessage; isOwn: boolean; showSender: boolean; _id: string };

function buildItems(messages: ChatMessage[], userId: string): ThreadItem[] {
  const items: ThreadItem[] = [];
  let lastDate = '';
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const date = formatDateHeader(msg.createdAt ?? new Date().toISOString());
    if (date !== lastDate) {
      items.push({ kind: 'date', date, _id: `date-${msg._id ?? i}` });
      lastDate = date;
    }
    const prevMsg = i > 0 ? messages[i - 1] : null;
    const showSender = !prevMsg || senderId(prevMsg) !== senderId(msg);
    items.push({ kind: 'msg', msg, isOwn: senderId(msg) === userId, showSender, _id: msg._id ?? `local-${i}` });
  }
  return items;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ChatThreadScreen() {
  const { groupId, channel, name, type } = useLocalSearchParams<{
    groupId: string;
    channel: string;
    name: string;
    type: string;
  }>();
  const userId = useSelector((s: RootState) => s.auth.userId) ?? '';
  const { joinChannel, leaveChannel, sendMessage, markRead, onMessage } = useSocket();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const pageRef = useRef(1);
  const [input, setInput] = useState('');
  const [showInfo, setShowInfo] = useState(false);
  const [members, setMembers] = useState<{ _id: string; name: string; email: string }[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const flatRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!channel) return;

    // Load history (page 1)
    pageRef.current = 1;
    fetchHistory(channel, 1, 50)
      .then((res) => {
        setMessages(res.data.reverse());
        setHasMore(res.total > 50);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    joinChannel(channel);
    markRead(channel);

    const unsub = onMessage((msg) => {
      if (msg.channel !== channel) return;
      setMessages((prev) => {
        // Replace optimistic message if sender matches & body matches
        const idx = prev.findIndex((m) => m._sending && m.body === msg.body);
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = msg;
          return next;
        }
        return [...prev, msg];
      });
      markRead(channel);
    });

    return () => {
      unsub();
      leaveChannel(channel);
    };
  }, [channel, groupId]);

  // Load group members for @mention + group info
  useEffect(() => {
    if (!groupId) return;
    fetchGroupById(groupId)
      .then((g) => setMembers(g.members))
      .catch(() => {});
  }, [groupId]);

  async function loadEarlier() {
    if (!channel || loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = pageRef.current + 1;
    try {
      const res = await fetchHistory(channel, nextPage, 50);
      const older = res.data.reverse();
      setMessages((prev) => [...older, ...prev]);
      pageRef.current = nextPage;
      setHasMore(res.total > nextPage * 50);
    } catch {}
    setLoadingMore(false);
  }

  function handleSend() {
    const text = input.trim();
    if (!text || !channel) return;

    // Optimistic append
    const optimistic: ChatMessage = {
      _id: `opt-${Date.now()}`,
      channel,
      sender: { _id: userId, name: 'You', email: '' },
      body: text,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: userId,
      _sending: true,
    } as unknown as ChatMessage;

    setMessages((prev) => [...prev, optimistic]);
    sendMessage(channel, text);
    setInput('');
    setMentionQuery(null);
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 80);
  }

  function handleInputChange(text: string) {
    setInput(text);
    // Detect @mention trigger
    const atIdx = text.lastIndexOf('@');
    if (atIdx !== -1 && atIdx === text.length - 1) {
      setMentionQuery('');
    } else if (atIdx !== -1) {
      const after = text.slice(atIdx + 1);
      if (/^[\w\s]*$/.test(after) && !after.includes(' ')) {
        setMentionQuery(after);
      } else {
        setMentionQuery(null);
      }
    } else {
      setMentionQuery(null);
    }
  }

  function handleMentionSelect(memberName: string) {
    const atIdx = input.lastIndexOf('@');
    setInput(input.slice(0, atIdx) + `@${memberName} `);
    setMentionQuery(null);
  }

  const items = buildItems(messages, userId);

  if (loading) {
    return (
      <View style={t.center}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={t.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      {/* Header */}
      <View style={t.header}>
        <TouchableOpacity onPress={() => router.back()} style={t.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={t.headerTitle} numberOfLines={1}>{name}</Text>
          <Text style={t.headerSub}>{members.length} members</Text>
        </View>
        <TouchableOpacity onPress={() => setShowInfo(true)} style={t.infoBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="information-circle-outline" size={24} color="#6366F1" />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatRef}
        data={items}
        keyExtractor={(item) => item._id}
        contentContainerStyle={t.list}
        onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          if (item.kind === 'date') return <DateHeader date={item.date} />;
          return <Bubble msg={item.msg} isOwn={item.isOwn} showSender={item.showSender} />;
        }}
        ListHeaderComponent={
          hasMore ? (
            <TouchableOpacity style={t.loadMoreBtn} onPress={loadEarlier} disabled={loadingMore}>
              {loadingMore
                ? <ActivityIndicator size="small" color="#6366F1" />
                : <Text style={t.loadMoreText}>Load earlier messages</Text>}
            </TouchableOpacity>
          ) : undefined
        }
        ListEmptyComponent={
          <Text style={t.empty}>No messages yet. Say hello! 👋</Text>
        }
      />

      {/* @mention picker */}
      {mentionQuery !== null && (
        <MentionPicker
          query={mentionQuery}
          members={members}
          onSelect={handleMentionSelect}
        />
      )}

      {/* Input bar */}
      <View style={t.inputBar}>
        <TextInput
          style={t.input}
          value={input}
          onChangeText={handleInputChange}
          placeholder="Type a message…"
          placeholderTextColor="#9CA3AF"
          multiline
          maxLength={2000}
          returnKeyType="default"
        />
        <TouchableOpacity
          style={[t.sendBtn, !input.trim() && t.sendBtnOff]}
          onPress={handleSend}
          disabled={!input.trim()}
        >
          <Ionicons name="send" size={18} color={input.trim() ? '#fff' : '#9CA3AF'} />
        </TouchableOpacity>
      </View>

      {/* Group info modal */}
      <GroupInfoModal
        visible={showInfo}
        onClose={() => setShowInfo(false)}
        groupId={groupId ?? ''}
        groupName={name ?? ''}
        groupType={(type as ChatGroupType) ?? 'custom'}
        members={members}
        currentUserId={userId}
        onLeft={() => router.replace('/(app)/chat/')}
      />
    </KeyboardAvoidingView>
  );
}

const t = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingTop: 52, paddingBottom: 12,
    paddingHorizontal: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', gap: 8,
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  infoBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  headerSub: { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  list: { paddingVertical: 12, flexGrow: 1 },
  empty: { textAlign: 'center', color: '#9CA3AF', marginTop: 48, fontSize: 15 },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    padding: 12, paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E5E7EB',
  },
  input: {
    flex: 1, minHeight: 44, maxHeight: 120, backgroundColor: '#F3F4F6',
    borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 15, color: '#111827',
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center' },
  sendBtnOff: { backgroundColor: '#F3F4F6' },
  loadMoreBtn: { alignItems: 'center', paddingVertical: 10, marginBottom: 8 },
  loadMoreText: { fontSize: 13, color: '#6366F1', fontWeight: '600' },
});
