import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { api } from '../src/services/api';
import { setAuth } from '../src/store/slices/auth.slice';
import { Toast, useToast } from '../src/components/Toast';

function decodeJwtSub(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

export default function LoginScreen() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaToken, setMfaToken] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast, show: showToast, hide: hideToast } = useToast();

  async function handleLogin() {
    if (!email || !password) return;
    setLoading(true);
    try {
      const res = await api.post<{
        requiresMfa?: boolean;
        userId?: string;
        accessToken?: string;
        refreshToken?: string;
      }>('/auth/login', { email, password });

      if (res.data.requiresMfa) {
        setMfaRequired(true);
        setUserId(res.data.userId!);
      } else {
        dispatch(setAuth({ accessToken: res.data.accessToken!, refreshToken: res.data.refreshToken!, userId: decodeJwtSub(res.data.accessToken!) ?? undefined }));
        // expo-notifications is native-only — skip on web
        if (Platform.OS !== 'web') {
          import('../src/services/notifications.service').then(({ registerForPushNotifications }) => {
            registerForPushNotifications().catch(() => {});
          });
        }
        router.replace('/(app)/projects');
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        if (!err.response) {
          showToast(
            `Cannot reach server. Check WiFi.\nAPI: ${process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'}`,
            'error',
          );
        } else if (err.response.status === 401) {
          showToast('Invalid credentials. Check your email and password.', 'error');
        } else {
          showToast(`Server error ${err.response.status}`, 'error');
        }
      } else {
        showToast(String(err), 'error');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleMfa() {
    setLoading(true);
    try {
      const res = await api.post<{ accessToken: string; refreshToken: string }>(
        '/auth/mfa/verify',
        { userId, token: mfaToken },
      );
      dispatch(setAuth({ accessToken: res.data.accessToken, refreshToken: res.data.refreshToken, userId: decodeJwtSub(res.data.accessToken) ?? undefined }));
      router.replace('/(app)/projects');
    } catch {
      showToast('Invalid MFA token. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <Toast message={toast.message} kind={toast.kind} visible={toast.visible} onHide={hideToast} />
      <View style={styles.card}>
        {/* Logo */}
        <View style={styles.logoWrap}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>TI</Text>
          </View>
        </View>
        <Text style={styles.title}>Trendy Interios</Text>
        <Text style={styles.subtitle}>
          {mfaRequired ? 'Two-factor authentication' : 'Sign in to continue'}
        </Text>

        {!mfaRequired ? (
          <>
            <Text style={styles.label}>{t('email')}</Text>
            <TextInput
              style={styles.input}
              placeholder="you@trendyinteriors.in"
              placeholderTextColor="#94A3B8"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            <Text style={styles.label}>{t('password')}</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#94A3B8"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
              accessibilityLabel={t('login')}
            >
              <Text style={styles.buttonText}>{loading ? 'Signing in…' : t('login')}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.mfaHint}>
              Enter the 6-digit code from your authenticator app.
            </Text>
            <TextInput
              style={[styles.input, styles.mfaInput]}
              placeholder="000000"
              placeholderTextColor="#94A3B8"
              value={mfaToken}
              onChangeText={setMfaToken}
              keyboardType="number-pad"
              maxLength={6}
            />
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleMfa}
              disabled={loading}
            >
              <Text style={styles.buttonText}>{loading ? 'Verifying…' : 'Verify'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setMfaRequired(false)} style={styles.backBtn}>
              <Text style={styles.backBtnText}>← Back to sign in</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 32,
  },
  logoWrap: { alignItems: 'center', marginBottom: 16 },
  logoCircle: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: { color: '#fff', fontWeight: '800', fontSize: 20 },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 24,
  },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    marginBottom: 14,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  button: {
    backgroundColor: '#4F46E5',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  mfaHint: { fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 20 },
  mfaInput: { textAlign: 'center', letterSpacing: 8, fontSize: 24, fontWeight: '700' },
  backBtn: { marginTop: 16, alignItems: 'center' },
  backBtnText: { color: '#4F46E5', fontSize: 14, fontWeight: '500' },
});
