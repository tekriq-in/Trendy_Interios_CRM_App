import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { useDispatch } from 'react-redux';
import axios from 'axios';
import { api } from '../src/services/api';
import { setAuth } from '../src/store/slices/auth.slice';
import { Toast, useToast } from '../src/components/Toast';

const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$/;

function decodeJwtSub(token: string): string | undefined {
  try {
    const encoded = token.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/');
    if (!encoded) return undefined;
    const padded = encoded + '='.repeat((4 - encoded.length % 4) % 4);
    return (JSON.parse(atob(padded)) as { sub?: string }).sub;
  } catch {
    return undefined;
  }
}

export default function ChangePasswordScreen() {
  const dispatch = useDispatch();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast, show: showToast, hide: hideToast } = useToast();

  async function handleSubmit() {
    if (!currentPassword) {
      showToast('Enter your current password.', 'error');
      return;
    }
    if (!PASSWORD_POLICY.test(newPassword)) {
      showToast('Use 8–128 characters with uppercase, lowercase, and a number.', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match.', 'error');
      return;
    }
    if (newPassword === currentPassword) {
      showToast('New password must be different from the current password.', 'error');
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post<{ accessToken: string; refreshToken: string }>(
        '/auth/change-password',
        { currentPassword, newPassword, confirmPassword },
      );
      dispatch(setAuth({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        userId: decodeJwtSub(data.accessToken),
      }));
      router.replace('/(app)/projects');
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          router.replace('/login');
        } else {
          const message = error.response?.data?.message;
          showToast(Array.isArray(message) ? message.join(', ') : (message ?? 'Password change failed.'), 'error');
        }
      } else {
        showToast('Password change failed. Please try again.', 'error');
      }
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
        <Text style={styles.title}>Change your password</Text>
        <Text style={styles.subtitle}>Enter your current password and choose a new password to continue.</Text>

        <Text style={styles.label}>Current password</Text>
        <TextInput
          style={styles.input}
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
          autoComplete="current-password"
          accessibilityLabel="Current password"
        />
        <Text style={styles.label}>New password</Text>
        <TextInput
          style={styles.input}
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          autoComplete="new-password"
          maxLength={128}
          accessibilityLabel="New password"
        />
        <Text style={styles.hint}>8–128 characters, including uppercase, lowercase, and a number.</Text>
        <Text style={styles.label}>Confirm new password</Text>
        <TextInput
          style={styles.input}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoComplete="new-password"
          maxLength={128}
          accessibilityLabel="Confirm new password"
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? 'Updating password…' : 'Set new password'}</Text>
        </TouchableOpacity>
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
    padding: 24,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#0F172A' },
  subtitle: { fontSize: 14, color: '#64748B', marginTop: 8, marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    marginBottom: 14,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  hint: { fontSize: 12, color: '#64748B', marginTop: -8, marginBottom: 14 },
  button: {
    backgroundColor: '#4F46E5',
    borderRadius: 10,
    minHeight: 48,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
