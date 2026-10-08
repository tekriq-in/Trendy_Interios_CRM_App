import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { api } from '../src/services/api';
import { setAuth } from '../src/store/slices/auth.slice';

export default function LoginScreen() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaToken, setMfaToken] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(false);

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
        dispatch(setAuth({ accessToken: res.data.accessToken!, refreshToken: res.data.refreshToken! }));
        router.replace('/(app)/projects');
      }
    } catch {
      Alert.alert('Error', t('invalidCredentials', 'Invalid credentials'));
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
      dispatch(setAuth({ accessToken: res.data.accessToken, refreshToken: res.data.refreshToken }));
      router.replace('/(app)/projects');
    } catch {
      Alert.alert('Error', 'Invalid MFA token');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Trendy Interiors</Text>

        {!mfaRequired ? (
          <>
            <TextInput
              style={styles.input}
              placeholder={t('email')}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            <TextInput
              style={styles.input}
              placeholder={t('password')}
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
              <Text style={styles.buttonText}>{loading ? '…' : t('login')}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.mfaHint}>Enter the 6-digit code from your authenticator app.</Text>
            <TextInput
              style={[styles.input, styles.mfaInput]}
              placeholder="000000"
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
              <Text style={styles.buttonText}>{loading ? '…' : 'Verify'}</Text>
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
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 12,
    color: '#111827',
  },
  button: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  mfaHint: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 16 },
  mfaInput: { textAlign: 'center', letterSpacing: 8, fontSize: 24 },
});
