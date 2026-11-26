import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { api } from '../src/services/api';
import { setAuth } from '../src/store/slices/auth.slice';
import { decodeJwt } from '../src/utils/jwt';
import { setLanguage, type Language } from '../src/store/slices/ui.slice';
import type { RootState } from '../src/store';
import { Button, TextField } from '../src/components/ui';
import { colors, font, radius, size } from '../src/theme';

type LoginResponse = {
  requiresMfa?: boolean;
  userId?: string;
  accessToken?: string;
  refreshToken?: string;
};

export default function LoginScreen() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const language = useSelector((s: RootState) => s.ui.language);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mfaToken, setMfaToken] = useState('');
  const [mfaUserId, setMfaUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function failureMessage(err: unknown, invalidKey: 'login.errInvalid' | 'login.errMfa'): string {
    if (axios.isAxiosError(err)) {
      if (!err.response) return t('login.errOffline');
      if (err.response.status === 401 || err.response.status === 400) return t(invalidKey);
    }
    return t('login.errServer');
  }

  async function finishSignIn(accessToken: string, refreshToken: string) {
    dispatch(setAuth({ accessToken, refreshToken }));
    // An admin reset this user's password: they must set a new one before using the app.
    router.replace(decodeJwt(accessToken)?.mustChangePassword ? '/change-password' : '/(app)/home');
  }

  async function handleLogin() {
    if (!identifier.trim() || !password) {
      setError(t('login.errRequired'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      // The API takes `identifier`: a phone number for staff, an email for MD/GM.
      const res = await api.post<LoginResponse>('/auth/login', {
        identifier: identifier.trim(),
        password,
      });
      if (res.data.requiresMfa && res.data.userId) {
        setMfaUserId(res.data.userId);
      } else if (res.data.accessToken && res.data.refreshToken) {
        await finishSignIn(res.data.accessToken, res.data.refreshToken);
      } else {
        setError(t('login.errServer'));
      }
    } catch (err) {
      setError(failureMessage(err, 'login.errInvalid'));
    } finally {
      setLoading(false);
    }
  }

  async function handleMfa() {
    if (!mfaUserId || mfaToken.length < 6) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.post<{ accessToken: string; refreshToken: string }>('/auth/mfa/verify', {
        userId: mfaUserId,
        token: mfaToken,
      });
      await finishSignIn(res.data.accessToken, res.data.refreshToken);
    } catch (err) {
      setError(failureMessage(err, 'login.errMfa'));
    } finally {
      setLoading(false);
    }
  }

  const inMfa = mfaUserId !== null;
  const pick = (lng: Language) => dispatch(setLanguage(lng));

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Language is reachable before sign-in: many staff read Tamil more comfortably. */}
        <View style={styles.langRow}>
          {(['en', 'ta'] as const).map((lng) => (
            <Pressable
              key={lng}
              onPress={() => pick(lng)}
              accessibilityRole="button"
              accessibilityState={{ selected: language === lng }}
              style={[styles.langBtn, language === lng && styles.langBtnActive]}
            >
              <Text style={[styles.langText, language === lng && styles.langTextActive]}>
                {lng === 'en' ? 'English' : 'தமிழ்'}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.brand}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>TI</Text>
          </View>
          <Text style={styles.brandName}>Trendy Interios</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>{inMfa ? t('login.mfaTitle') : t('login.welcome')}</Text>
          <Text style={styles.sub}>{inMfa ? t('login.mfaHelp') : t('login.subtitle')}</Text>

          {error ? (
            <View style={styles.errorBox} accessibilityLiveRegion="polite">
              <Ionicons name="alert-circle" size={20} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {!inMfa ? (
            <>
              <TextField
                label={t('login.identifier')}
                hint={t('login.identifierHint')}
                value={identifier}
                onChangeText={setIdentifier}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                keyboardType="email-address"
                returnKeyType="next"
                textContentType="username"
              />
              <View>
                <TextField
                  label={t('login.password')}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="password"
                  returnKeyType="go"
                  onSubmitEditing={handleLogin}
                  textContentType="password"
                />
                <Pressable
                  onPress={() => setShowPassword((v) => !v)}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? t('login.hide') : t('login.show')}
                  hitSlop={8}
                  style={styles.eye}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={24}
                    color={colors.textSubtle}
                  />
                </Pressable>
              </View>
              <Button
                label={loading ? t('login.signingIn') : t('login.signIn')}
                onPress={handleLogin}
                loading={loading}
              />
            </>
          ) : (
            <>
              <TextField
                label={t('login.mfaCode')}
                value={mfaToken}
                onChangeText={(v) => setMfaToken(v.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
                textContentType="oneTimeCode"
              />
              <Button
                label={t('login.verify')}
                onPress={handleMfa}
                loading={loading}
                disabled={mfaToken.length < 6}
              />
              <View style={{ height: 8 }} />
              <Button
                label={t('login.backToSignIn')}
                variant="ghost"
                onPress={() => {
                  setMfaUserId(null);
                  setMfaToken('');
                  setError('');
                }}
              />
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, paddingHorizontal: 20 },
  langRow: { flexDirection: 'row', alignSelf: 'flex-end', gap: 8, marginBottom: 12 },
  langBtn: {
    minHeight: size.minTap,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  langBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  langText: { fontSize: 15, fontWeight: '700', color: colors.textMuted },
  langTextActive: { color: colors.onPrimary },
  brand: { alignItems: 'center', marginTop: 8, marginBottom: 24 },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoText: { color: colors.onPrimary, fontSize: 28, fontWeight: '800', letterSpacing: 1 },
  brandName: { ...font.h2, fontSize: 22 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heading: { ...font.title, fontSize: 24 },
  sub: { ...font.body, color: colors.textSubtle, marginTop: 6, marginBottom: 20 },
  errorBox: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 16,
  },
  errorText: { flex: 1, color: colors.danger, fontSize: 15, fontWeight: '600' },
  eye: { position: 'absolute', right: 6, top: 28, width: size.minTap, height: size.minTap, alignItems: 'center', justifyContent: 'center' },
});
