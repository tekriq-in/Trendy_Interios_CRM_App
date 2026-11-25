import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { ChatGroupType } from '@ti/shared';
import { useSocket } from '../../../src/context/socket.context';
import { fetchGroupById, fetchHistory } from '../../../src/services/chat.service';
import { uploadChatPhoto } from '../../../src/services/uploads';
import { pickPhoto, type PhotoSource } from '../../../src/utils/photo';
import { dateHeader } from '../../../src/utils/format';
import type { RootState } from '../../../src/store';
import { Toast, useToast } from '../../../src/components/Toast';
import { ErrorState, HeaderIconButton, ScreenHeader } from '../../../src/components/ui';
import { GroupInfoModal } from '../../../src/components/chat/GroupInfoModal';
import { MessageBubble, PHOTO_BODY, senderId, type LocalMessage } from '../../../src/components/chat/MessageBubble';
import { colors, font, size, spacing } from '../../../src/theme';

interface Member {
  _id: string;
  name: string;
  email: string;
}

type Row =
  | { kind: 'date'; key: string; label: string }
  | { kind: 'msg'; key: string; msg: LocalMessage; isOwn: boolean; showSender: boolean };

const PAGE = 50;
const byTime = (a: LocalMessage, b: LocalMessage) =>
  new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime();

/** Newest history merged with what is already on screen (older pages, sending and failed messages). */
function mergeLatest(prev: LocalMessage[], latest: LocalMessage[]): LocalMessage[] {
  const known = new Set(latest.map((m) => m._id));
  return [...prev.filter((m) => !known.has(m._id)), ...latest].sort(byTime);
}

export default function ChatThreadScreen() {
  const { groupId, channel, name, type } = useLocalSearchParams<{ groupId: string; channel: string; name: string; type: string }>();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const userId = useSelector((s: RootState) => s.auth.userId) ?? '';
  const { joinChannel, leaveChannel, sendMessage, markRead, onMessage, connected } = useSocket();
  const { toast, show: showToast, hide: hideToast } = useToast();

  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [input, setInput] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [showInfo, setShowInfo] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const pageRef = useRef(1);
  const wasConnected = useRef(connected);

  // ---- loading ------------------------------------------------------------

  const loadLatest = useCallback(async () => {
    if (!channel) return;
    try {
      const res = await fetchHistory(channel, 1, PAGE);
      setMessages((prev) => mergeLatest(prev, [...res.data].reverse()));
      setHasMore(res.total > PAGE);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [channel]);

  useEffect(() => {
    if (!channel) return;
    pageRef.current = 1;
    void loadLatest();
    joinChannel(channel);
    markRead(channel);

    const unsubscribe = onMessage((msg) => {
      if (msg.channel !== channel) return;
      // De-duplicate by id: the sender also gets the broadcast, and the send
      // acknowledgement may arrive before or after it.
      setMessages((prev) => (prev.some((m) => m._id === msg._id) ? prev : [...prev, msg].sort(byTime)));
      markRead(channel);
    });
    return () => {
      unsubscribe();
      leaveChannel(channel);
    };
  }, [channel, loadLatest, joinChannel, leaveChannel, markRead, onMessage]);

  // After a dropped connection the server forgets our rooms, so re-join and
  // catch up on anything missed. (Previously the chat just went silent.)
  useEffect(() => {
    if (connected && !wasConnected.current && channel) {
      joinChannel(channel);
      void loadLatest();
    }
    wasConnected.current = connected;
  }, [connected, channel, joinChannel, loadLatest]);

  const loadMembers = useCallback(() => {
    if (!groupId) return;
    fetchGroupById(groupId)
      .then((g) => setMembers(g.members))
      .catch(() => {});
  }, [groupId]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  async function loadEarlier() {
    if (!channel || loadingMore || !hasMore) return;
    setLoadingMore(true);
    const next = pageRef.current + 1;
    try {
      const res = await fetchHistory(channel, next, PAGE);
      setMessages((prev) => mergeLatest(prev, [...res.data].reverse()));
      pageRef.current = next;
      setHasMore(res.total > next * PAGE);
    } catch {
      showToast(t('common.checkConnection'), 'error');
    } finally {
      setLoadingMore(false);
    }
  }

  // ---- sending ------------------------------------------------------------

  /** Sends (or re-sends) a message; shows it as failed, with retry, if it does not go through. */
  async function deliver(temp: LocalMessage) {
    try {
      let mediaUrl = temp.mediaUrl ?? undefined;
      // A photo is uploaded first; its link is what the message carries.
      if (temp._photo && !(mediaUrl ?? '').startsWith('http')) {
        mediaUrl = await uploadChatPhoto(temp._photo);
        setMessages((prev) => prev.map((m) => (m._id === temp._id ? { ...m, mediaUrl } : m)));
      }
      const saved = await sendMessage(temp.channel, temp.body, mediaUrl ? { mediaType: 'image', mediaUrl } : undefined);
      setMessages((prev) => {
        const without = prev.filter((m) => m._id !== temp._id);
        return without.some((m) => m._id === saved._id) ? without : [...without, saved].sort(byTime);
      });
    } catch {
      setMessages((prev) => prev.map((m) => (m._id === temp._id ? { ...m, _sending: false, _failed: true } : m)));
    }
  }

  function makeTemp(partial: Partial<LocalMessage>): LocalMessage {
    const now = new Date().toISOString();
    return {
      _id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      channel,
      sender: { _id: userId, name: '', email: '' },
      body: '',
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
      _sending: true,
      ...partial,
    } as unknown as LocalMessage;
  }

  function handleSend() {
    const text = input.trim();
    if (!text || !channel) return;
    const temp = makeTemp({ body: text });
    setMessages((prev) => [...prev, temp]);
    setInput('');
    setMentionQuery(null);
    void deliver(temp);
  }

  async function sendPhoto(source: PhotoSource) {
    if (!channel) return;
    const result = await pickPhoto(source);
    if (result.status === 'denied') {
      showToast(t('handover.cameraDenied'), 'error');
      return;
    }
    if (result.status !== 'ok') return;
    const temp = makeTemp({ body: PHOTO_BODY, mediaType: 'image', mediaUrl: result.photo.uri, _photo: result.photo });
    setMessages((prev) => [...prev, temp]);
    void deliver(temp);
  }

  function retry(msg: LocalMessage) {
    const again = { ...msg, _failed: false, _sending: true };
    setMessages((prev) => prev.map((m) => (m._id === msg._id ? again : m)));
    void deliver(again);
  }

  const remove = (msg: LocalMessage) => setMessages((prev) => prev.filter((m) => m._id !== msg._id));

  // ---- @mentions ----------------------------------------------------------

  function onInputChange(text: string) {
    setInput(text);
    const at = text.lastIndexOf('@');
    if (at === -1) return setMentionQuery(null);
    const after = text.slice(at + 1);
    setMentionQuery(/^\w*$/.test(after) ? after : null);
  }

  function pickMention(memberName: string) {
    const at = input.lastIndexOf('@');
    setInput(`${input.slice(0, at)}@${memberName} `);
    setMentionQuery(null);
  }

  const mentionMatches = useMemo(
    () => (mentionQuery === null ? [] : members.filter((m) => m._id !== userId && m.name.toLowerCase().startsWith(mentionQuery.toLowerCase())).slice(0, 4)),
    [mentionQuery, members, userId],
  );

  // ---- list ---------------------------------------------------------------

  // Inverted list (newest at the bottom, "load earlier" at the top), so new messages
  // never jump the scroll position and loading older ones does not either.
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    let lastDay = '';
    messages.forEach((msg, i) => {
      const day = dateHeader(msg.createdAt, i18n.language, t);
      if (day !== lastDay) {
        out.push({ kind: 'date', key: `date-${msg._id}`, label: day });
        lastDay = day;
      }
      const prev = i > 0 ? messages[i - 1] : null;
      out.push({ kind: 'msg', key: msg._id, msg, isOwn: senderId(msg) === userId, showSender: !prev || senderId(prev) !== senderId(msg) });
    });
    return out.reverse();
  }, [messages, userId, i18n.language, t]);

  const canSend = input.trim().length > 0;

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Toast message={toast.message} kind={toast.kind} visible={toast.visible} onHide={hideToast} />
      <ScreenHeader
        title={name ?? t('chat.title')}
        subtitle={members.length ? t('chat.members', { count: members.length }) : undefined}
        back
        right={<HeaderIconButton icon="information-circle-outline" label={t('chat.groupInfo')} onPress={() => setShowInfo(true)} />}
      />

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} size="large" />
      ) : failed && messages.length === 0 ? (
        <ErrorState
          title={t('common.couldNotLoad')}
          message={t('common.checkConnection')}
          retryLabel={t('common.retry')}
          onRetry={() => {
            setLoading(true);
            void loadLatest();
          }}
        />
      ) : (
        <FlatList
          data={rows}
          inverted
          keyExtractor={(r) => r.key}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) =>
            item.kind === 'date' ? (
              <View style={styles.dateWrap}>
                <Text style={styles.date}>{item.label}</Text>
              </View>
            ) : (
              <MessageBubble
                msg={item.msg}
                isOwn={item.isOwn}
                showSender={item.showSender}
                onRetry={() => retry(item.msg)}
                onRemove={() => remove(item.msg)}
                onOpenImage={(url) => void WebBrowser.openBrowserAsync(url)}
              />
            )
          }
          ListEmptyComponent={<Text style={[styles.empty, { transform: [{ scaleY: -1 }] }]}>{t('chat.noMessages')}</Text>}
          ListFooterComponent={
            hasMore ? (
              <Pressable onPress={loadEarlier} disabled={loadingMore} style={styles.earlier} accessibilityRole="button">
                {loadingMore ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.earlierText}>{t('chat.loadEarlier')}</Text>}
              </Pressable>
            ) : undefined
          }
        />
      )}

      {mentionMatches.length > 0 ? (
        <View style={styles.mentions}>
          {mentionMatches.map((m) => (
            <Pressable key={m._id} onPress={() => pickMention(m.name)} style={styles.mention} accessibilityRole="button">
              <Text style={font.bodyStrong}>{m.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
        <Pressable onPress={() => sendPhoto('camera')} accessibilityRole="button" accessibilityLabel={t('chat.camera')} style={styles.iconBtn}>
          <Ionicons name="camera" size={26} color={colors.primary} />
        </Pressable>
        <Pressable onPress={() => sendPhoto('library')} accessibilityRole="button" accessibilityLabel={t('chat.gallery')} style={styles.iconBtn}>
          <Ionicons name="image" size={26} color={colors.primary} />
        </Pressable>
        <TextInput
          value={input}
          onChangeText={onInputChange}
          placeholder={t('chat.typeMessage')}
          placeholderTextColor={colors.placeholder}
          style={styles.input}
          accessibilityLabel={t('chat.typeMessage')}
          multiline
          maxLength={2000}
        />
        <Pressable
          onPress={handleSend}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel={t('chat.send')}
          accessibilityState={{ disabled: !canSend }}
          style={[styles.send, !canSend && styles.sendOff]}
        >
          <Ionicons name="send" size={20} color={canSend ? colors.onPrimary : colors.textSubtle} />
        </Pressable>
      </View>

      <GroupInfoModal
        visible={showInfo}
        onClose={() => setShowInfo(false)}
        groupId={groupId ?? ''}
        groupName={name ?? ''}
        groupType={(type as ChatGroupType) ?? 'custom'}
        members={members}
        currentUserId={userId}
        onChanged={loadMembers}
        onLeft={() => router.replace('/(app)/chat')}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  list: { paddingVertical: spacing.md, flexGrow: 1 },
  dateWrap: { alignItems: 'center', marginVertical: spacing.md },
  date: { ...font.caption, fontWeight: '800', backgroundColor: colors.neutralSoft, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, overflow: 'hidden' },
  empty: { textAlign: 'center', color: colors.textSubtle, marginTop: 48, fontSize: 16 },
  earlier: { alignItems: 'center', justifyContent: 'center', minHeight: size.minTap, marginVertical: spacing.sm },
  earlierText: { color: colors.primary, fontSize: 15, fontWeight: '700' },
  mentions: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  mention: { minHeight: size.minTap, justifyContent: 'center', paddingHorizontal: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, paddingHorizontal: spacing.sm, paddingTop: spacing.sm, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  iconBtn: { width: size.minTap, height: size.minTap, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, minHeight: size.minTap, maxHeight: 120, backgroundColor: colors.surfaceMuted, borderRadius: 24, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, fontSize: 16, color: colors.text },
  send: { width: size.minTap, height: size.minTap, borderRadius: size.minTap / 2, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendOff: { backgroundColor: colors.neutralSoft },
});
