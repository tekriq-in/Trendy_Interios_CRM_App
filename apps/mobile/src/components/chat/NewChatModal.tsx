import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { fetchUsers, openDM, createGroup } from '../../services/chat.service';
import { Avatar, Button, Chip, HeaderIconButton, ScreenHeader, TextField } from '../ui';
import { colors, font, size, spacing } from '../../theme';

interface Person {
  _id: string;
  name: string;
  email: string;
}

/**
 * Start a direct message with one person, or a group with several. Full-screen so
 * the list of people has room, with large rows and a visible tick for selection.
 */
export function NewChatModal({ visible, onClose, currentUserId }: { visible: boolean; onClose: () => void; currentUserId: string }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'dm' | 'group'>('dm');
  const [people, setPeople] = useState<Person[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setMode('dm');
    setSearch('');
    setSelected([]);
    setGroupName('');
    setError('');
    setLoading(true);
    fetchUsers()
      .then((u) => setPeople(u.filter((p) => p._id !== currentUserId)))
      .catch(() => setError(t('chat.couldNotStart')))
      .finally(() => setLoading(false));
  }, [visible, currentUserId, t]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? people.filter((p) => p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)) : people;
  }, [people, search]);

  async function startDm(person: Person) {
    setBusy(true);
    setError('');
    try {
      const group = await openDM(person._id);
      onClose();
      router.push({
        pathname: '/(app)/chat/[groupId]',
        params: { groupId: group._id, channel: group.channel, name: person.name, type: 'individual' },
      });
    } catch {
      setError(t('chat.couldNotStart'));
    } finally {
      setBusy(false);
    }
  }

  async function makeGroup() {
    if (!groupName.trim() || selected.length === 0) return;
    setBusy(true);
    setError('');
    try {
      const group = await createGroup({ name: groupName.trim(), memberIds: selected });
      onClose();
      router.push({
        pathname: '/(app)/chat/[groupId]',
        params: { groupId: group._id, channel: group.channel, name: group.name, type: 'custom' },
      });
    } catch {
      setError(t('chat.couldNotStart'));
    } finally {
      setBusy(false);
    }
  }

  const toggle = (id: string) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.root}>
        <ScreenHeader
          title={t('chat.newChat')}
          right={<HeaderIconButton icon="close" label={t('common.close')} onPress={onClose} />}
        />

        <View style={styles.modes}>
          <Chip label={t('chat.directMessage')} selected={mode === 'dm'} onPress={() => setMode('dm')} />
          <Chip label={t('chat.newGroup')} selected={mode === 'group'} onPress={() => setMode('group')} />
        </View>

        {mode === 'group' ? (
          <View style={styles.pad}>
            <TextField label={t('chat.groupName')} value={groupName} onChangeText={setGroupName} maxLength={60} />
          </View>
        ) : null}

        <View style={[styles.search, styles.pad]}>
          <Ionicons name="search" size={20} color={colors.textSubtle} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('chat.searchPeople')}
            placeholderTextColor={colors.placeholder}
            style={styles.searchInput}
            accessibilityLabel={t('chat.searchPeople')}
            autoCorrect={false}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
        ) : (
          <FlatList
            data={shown}
            keyExtractor={(p) => p._id}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const picked = selected.includes(item._id);
              return (
                <Pressable
                  onPress={() => (mode === 'dm' ? startDm(item) : toggle(item._id))}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityState={{ selected: mode === 'group' ? picked : undefined }}
                  style={({ pressed }) => [styles.person, pressed && { backgroundColor: colors.surfaceMuted }]}
                >
                  <Avatar name={item.name} size={44} />
                  <View style={styles.flex}>
                    <Text style={font.bodyStrong}>{item.name}</Text>
                    <Text style={font.caption}>{item.email}</Text>
                  </View>
                  {mode === 'group' ? (
                    <Ionicons name={picked ? 'checkbox' : 'square-outline'} size={26} color={picked ? colors.primary : colors.borderStrong} />
                  ) : null}
                </Pressable>
              );
            }}
          />
        )}

        {mode === 'group' ? (
          <View style={styles.footer}>
            <Button
              label={`${t('chat.createGroup')} (${t('chat.members', { count: selected.length })})`}
              icon="people"
              onPress={makeGroup}
              loading={busy}
              disabled={!groupName.trim() || selected.length === 0}
            />
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  pad: { paddingHorizontal: spacing.lg },
  modes: { flexDirection: 'row', gap: spacing.sm, padding: spacing.lg },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: size.control,
    marginHorizontal: spacing.lg,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    marginBottom: spacing.sm,
  },
  searchInput: { flex: 1, fontSize: 16, color: colors.text, minHeight: size.control },
  error: { color: colors.danger, fontWeight: '600', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 64,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  footer: { padding: spacing.lg, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
});
