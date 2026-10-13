import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { clearAuth } from '../../../src/store/slices/auth.slice';
import type { RootState } from '../../../src/store';

function decodeJwt(token: string): Record<string, unknown> {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return {};
  }
}

export default function ProfileScreen() {
  const dispatch = useDispatch();
  const { i18n } = useTranslation();
  const accessToken = useSelector((s: RootState) => s.auth.accessToken);
  const currentLang = i18n.language;

  const userInfo = useMemo(() => {
    if (!accessToken) return { name: 'Staff', role: 'Employee', initials: 'ST', email: '' };
    const payload = decodeJwt(accessToken);
    const name = (payload.name as string) || (payload.email as string)?.split('@')[0] || 'Staff';
    const role = (payload.role as string) || 'Employee';
    const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
    const email = (payload.email as string) || '';
    return { name, role, initials, email };
  }, [accessToken]);

  function handleSignOut() {
    dispatch(clearAuth());
    router.replace('/login');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Profile</Text>

      {/* Avatar + info */}
      <View style={styles.avatarCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{userInfo.initials}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.name} numberOfLines={1}>{userInfo.name}</Text>
          <Text style={styles.role}>{userInfo.role}</Text>
          {userInfo.email ? <Text style={styles.email} numberOfLines={1}>{userInfo.email}</Text> : null}
        </View>
      </View>

      {/* Language */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>LANGUAGE</Text>
        <View style={styles.langRow}>
          <TouchableOpacity
            style={[styles.langBtn, currentLang === 'en' && styles.langBtnActive]}
            onPress={() => i18n.changeLanguage('en')}
            accessibilityLabel="Switch to English"
          >
            <Text style={[styles.langBtnText, currentLang === 'en' && styles.langBtnTextActive]}>
              English
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.langBtn, currentLang === 'ta' && styles.langBtnActive]}
            onPress={() => i18n.changeLanguage('ta')}
            accessibilityLabel="Switch to Tamil"
          >
            <Text style={[styles.langBtnText, currentLang === 'ta' && styles.langBtnTextActive]}>
              தமிழ்
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Sign out */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        <TouchableOpacity
          style={styles.signOutBtn}
          onPress={handleSignOut}
          accessibilityLabel="Sign out"
        >
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.version}>Trendy Interios CRM · v0.1.0</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 20,
    paddingTop: 64,
  },
  heading: { fontSize: 24, fontWeight: '700', color: '#0F172A', marginBottom: 24 },
  avatarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 28,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 18 },
  name: { fontSize: 16, fontWeight: '600', color: '#0F172A' },
  role: { fontSize: 13, color: '#64748B', marginTop: 2 },
  email: { fontSize: 12, color: '#94A3B8', marginTop: 3 },
  section: { marginBottom: 28 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 1,
    marginBottom: 10,
  },
  langRow: { flexDirection: 'row', gap: 12 },
  langBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  langBtnActive: { borderColor: '#4F46E5', backgroundColor: '#EEF2FF' },
  langBtnText: { fontSize: 15, fontWeight: '600', color: '#64748B' },
  langBtnTextActive: { color: '#4F46E5' },
  signOutBtn: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
    minHeight: 56,
    justifyContent: 'center',
  },
  signOutText: { color: '#DC2626', fontWeight: '700', fontSize: 16 },
  version: {
    textAlign: 'center',
    color: '#CBD5E1',
    fontSize: 12,
    position: 'absolute',
    bottom: 32,
    left: 0,
    right: 0,
  },
});
