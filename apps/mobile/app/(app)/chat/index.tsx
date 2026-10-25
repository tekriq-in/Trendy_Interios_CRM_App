import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  SectionList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Modal,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { router } from 'expo-router';
import { useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { useSocket } from '../../../src/context/socket.context';
import {
  fetchGroups,
  fetchUsers,
  openDM,
  createGroup,
} from '../../../src/services/chat.service';
import type { ChatGroup, ChatGroupType } from '@ti/shared';
import type { RootState } from '../../../src/store';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function initials(name?: string) {
  if (!name) return '?';
  return name.split(' ').map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase() || '?';
}

function relativeTime(iso?: string) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return `${Math.floor(diff / 86_400_000)}d`;
}

const TYPE_ICONS: Record<ChatGroupType, string> = {
  individual: 'person-circle-outline',
  project: 'folder-outline',
  department: 'business-outline',
  custom: 'people-outline',
};

const TYPE_COLORS: Record<ChatGroupType, string> = {
  individual: '#6366F1',
  project: '#0EA5E9',
  department: '#10B981',
  custom: '#F59E0B',
};

const SECTION_LABELS: Record<ChatGroupType, string> = {
  individual: 'Direct Messages',
  project: 'Projects',
  department: 'Departments',
  custom: 'Teams',
};

// ─── New Chat Modal ───────────────────────────────────────────────────────────

interface NewChatModalProps {
  visible: boolean;
  onClose: () => void;
  currentUserId: string;
}

function NewChatModal({ visible, onClose, currentUserId }: NewChatModalProps) {
  const [mode, setMode] = useState<'dm' | 'group'>('dm');
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<{ _id: string; name: string; email: string }[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    fetchUsers()
      .then((u) => setUsers(u.filter((x) => x._id !== currentUserId)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [visible, currentUserId]);

  function resetAndClose() {
    setMode('dm');
    setSearch('');
    setSelectedIds([]);
    setGroupName('');
    onClose();
  }

  async function handleDM(userId: string) {
    setCreating(true);
    try {
      const group = await openDM(userId);
      resetAndClose();
      router.push({
        pathname: '/(app)/chat/[groupId]',
        params: { groupId: group._id, channel: group.channel, name: group.members.find(m => String(m._id) !== currentUserId)?.name ?? 'Chat', type: 'individual' },
      });
    } catch {}
    setCreating(false);
  }

  async function handleCreateGroup() {
    if (!groupName.trim() || selectedIds.length === 0) return;
    setCreating(true);
    try {
      const group = await createGroup({ name: groupName.trim(), memberIds: selectedIds });
      resetAndClose();
      router.push({
        pathname: '/(app)/chat/[groupId]',
        params: { groupId: group._id, channel: group.channel, name: group.name, type: 'custom' },
      });
    } catch {}
    setCreating(false);
  }

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={resetAndClose}>
      <SafeAreaView style={nc.container}>
        <View style={nc.header}>
          <Text style={nc.title}>New Chat</Text>
          <TouchableOpacity onPress={resetAndClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="close" size={24} color="#374151" />
          </TouchableOpacity>
        </View>

        <View style={nc.tabs}>
          {(['dm', 'group'] as const).map((m) => (
            <TouchableOpacity key={m} style={[nc.tab, mode === m && nc.tabActive]} onPress={() => setMode(m)}>
              <Text style={[nc.tabText, mode === m && nc.tabTextActive]}>
                {m === 'dm' ? 'Direct Message' : 'New Group'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {mode === 'group' && (
          <View style={nc.groupNameRow}>
            <TextInput
              style={nc.groupNameInput}
              placeholder="Group name…"
              placeholderTextColor="#9CA3AF"
              value={groupName}
              onChangeText={setGroupName}
            />
          </View>
        )}

        <View style={nc.searchRow}>
          <Ionicons name="search-outline" size={16} color="#9CA3AF" style={{ marginLeft: 12 }} />
          <TextInput
            style={nc.searchInput}
            placeholder={mode === 'dm' ? 'Search employees…' : 'Add members…'}
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} />
        ) : (
          <SectionList
            sections={[{ title: '', data: filtered }]}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => {
              const selected = selectedIds.includes(item._id);
              return (
                <TouchableOpacity
                  style={nc.userRow}
                  onPress={() => {
                    if (mode === 'dm') {
                      handleDM(item._id);
                    } else {
                      setSelectedIds((prev) =>
                        prev.includes(item._id) ? prev.filter((id) => id !== item._id) : [...prev, item._id],
                      );
                    }
                  }}
                >
                  <View style={[nc.avatar, { backgroundColor: '#6366F1' }]}>
                    <Text style={nc.avatarText}>{initials(item.name)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={nc.userName}>{item.name}</Text>
                    <Text style={nc.userEmail}>{item.email}</Text>
                  </View>
                  {mode === 'group' && (
                    <Ionicons
                      name={selected ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={selected ? '#6366F1' : '#D1D5DB'}
                    />
                  )}
                </TouchableOpacity>
              );
            }}
            renderSectionHeader={() => null}
          />
        )}

        {mode === 'group' && (
          <View style={nc.footer}>
            <TouchableOpacity
              style={[nc.createBtn, (!groupName.trim() || selectedIds.length === 0) && nc.createBtnDisabled]}
              onPress={handleCreateGroup}
              disabled={!groupName.trim() || selectedIds.length === 0 || creating}
            >
              {creating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={nc.createBtnText}>Create Group ({selectedIds.length} members)</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const nc = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', backgroundColor: '#fff' },
  title: { fontSize: 18, fontWeight: '700', color: '#111827' },
  tabs: { flexDirection: 'row', backgroundColor: '#F3F4F6', margin: 16, borderRadius: 10, padding: 3 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: .06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  tabText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  tabTextActive: { color: '#111827' },
  groupNameRow: { paddingHorizontal: 16, marginBottom: 8 },
  groupNameInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#111827' },
  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, marginHorizontal: 16, marginBottom: 8 },
  searchInput: { flex: 1, paddingHorizontal: 10, paddingVertical: 12, fontSize: 15, color: '#111827' },
  userRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', backgroundColor: '#fff', gap: 12, minHeight: 64 },
  avatar: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  userName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  userEmail: { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#E5E7EB', backgroundColor: '#fff' },
  createBtn: { backgroundColor: '#6366F1', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  createBtnDisabled: { backgroundColor: '#C7D2FE' },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

// ─── Conversation Row ─────────────────────────────────────────────────────────

interface ConversationRowProps {
  group: ChatGroup;
  unread: number;
  currentUserId: string;
  onPress: () => void;
}

function ConversationRow({ group, unread, currentUserId, onPress }: ConversationRowProps) {
  const color = TYPE_COLORS[group.type];
  const iconName = TYPE_ICONS[group.type] as keyof typeof Ionicons.glyphMap;
  const displayName =
    group.type === 'individual'
      ? group.displayName ?? group.name
      : group.name;

  return (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.7}>
      <View style={[s.avatar, { backgroundColor: color }]}>
        <Ionicons name={iconName} size={20} color="#fff" />
      </View>
      <View style={s.rowMid}>
        <Text style={s.rowName} numberOfLines={1}>{displayName}</Text>
        <Text style={s.rowSub} numberOfLines={1}>
          {group.lastMessage
            ? `${group.lastMessage.senderName}: ${group.lastMessage.body}`
            : group.members.length > 1 ? `${group.members.length} members` : 'Direct message'}
        </Text>
      </View>
      <View style={s.rowRight}>
        <Text style={s.rowTime}>{relativeTime(group.updatedAt)}</Text>
        {unread > 0 && (
          <View style={s.badge}>
            <Text style={s.badgeText}>{unread > 99 ? '99+' : unread}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

const GROUP_ORDER: ChatGroupType[] = ['individual', 'project', 'custom', 'department'];

export default function ChatListScreen() {
  const userId = useSelector((s: RootState) => s.auth.userId) ?? '';
  const { unreadMap } = useSocket();
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const data = await fetchGroups();
      setGroups(data);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const sections = GROUP_ORDER.map((type) => {
    const data = groups.filter((g) => {
      if (g.type !== type) return false;
      if (!search) return true;
      const label = type === 'individual'
        ? g.members.find((m) => m._id !== userId)?.name ?? g.name
        : g.name;
      return label.toLowerCase().includes(search.toLowerCase());
    });
    return { title: SECTION_LABELS[type], type, data };
  }).filter((s) => s.data.length > 0);

  const totalUnread = Object.values(unreadMap).reduce((a, b) => a + b, 0);

  function navigateToThread(group: ChatGroup) {
    const name = group.type === 'individual'
      ? group.displayName ?? group.name
      : group.name;
    router.push({
      pathname: '/(app)/chat/[groupId]',
      params: { groupId: group._id, channel: group.channel, name, type: group.type },
    });
  }

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Chat</Text>
          {totalUnread > 0 && (
            <Text style={s.headerSub}>{totalUnread} unread</Text>
          )}
        </View>
        <TouchableOpacity style={s.newBtn} onPress={() => setShowNew(true)}>
          <Ionicons name="create-outline" size={22} color="#6366F1" />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={s.searchBar}>
        <Ionicons name="search-outline" size={16} color="#9CA3AF" style={{ marginLeft: 12 }} />
        <TextInput
          style={s.searchInput}
          placeholder="Search conversations…"
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} style={{ paddingRight: 12 }}>
            <Ionicons name="close-circle" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {sections.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="chatbubbles-outline" size={52} color="#D1D5DB" />
          <Text style={s.emptyTitle}>No conversations yet</Text>
          <Text style={s.emptySub}>Start a direct message or create a team group.</Text>
          <TouchableOpacity style={s.emptyBtn} onPress={() => setShowNew(true)}>
            <Text style={s.emptyBtnText}>Start a Chat</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item._id}
          renderSectionHeader={({ section }) => (
            <View style={s.sectionHeader}>
              <Text style={s.sectionLabel}>{section.title}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <ConversationRow
              group={item}
              unread={unreadMap[item.channel] ?? 0}
              currentUserId={userId}
              onPress={() => navigateToThread(item)}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(true); }}
              tintColor="#6366F1"
            />
          }
          contentContainerStyle={{ paddingBottom: 32 }}
          stickySectionHeadersEnabled={false}
        />
      )}

      <NewChatModal
        visible={showNew}
        onClose={() => { setShowNew(false); load(true); }}
        currentUserId={userId}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 20,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#111827' },
  headerSub: { fontSize: 12, color: '#6366F1', fontWeight: '600', marginTop: 1 },
  newBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  searchInput: { flex: 1, paddingHorizontal: 10, paddingVertical: 14, fontSize: 15, color: '#111827' },
  sectionHeader: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 6 },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.6 },
  row: {
    flexDirection: 'row', alignItems: 'center', padding: 14, paddingHorizontal: 20,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
    minHeight: 72, gap: 12,
  },
  avatar: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center' },
  rowMid: { flex: 1 },
  rowName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  rowSub: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  rowRight: { alignItems: 'flex-end', gap: 6 },
  rowTime: { fontSize: 12, color: '#9CA3AF' },
  badge: { backgroundColor: '#6366F1', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151' },
  emptySub: { fontSize: 14, color: '#9CA3AF', textAlign: 'center' },
  emptyBtn: { marginTop: 8, backgroundColor: '#6366F1', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24 },
  emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
