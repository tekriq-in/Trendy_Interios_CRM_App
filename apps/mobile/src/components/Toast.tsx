import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../theme';

type ToastKind = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  kind?: ToastKind;
  visible: boolean;
  onHide: () => void;
  duration?: number;
}

const KIND: Record<ToastKind, { bg: string; fg: string; icon: 'checkmark-circle' | 'alert-circle' | 'information-circle' }> = {
  success: { bg: colors.successSoft, fg: colors.success, icon: 'checkmark-circle' },
  error: { bg: colors.dangerSoft, fg: colors.danger, icon: 'alert-circle' },
  info: { bg: colors.infoSoft, fg: colors.info, icon: 'information-circle' },
};

/**
 * Short message that slides in from the top and hides itself. Positioned from the
 * safe-area inset, so it never sits under the status bar or notch. Errors stay a
 * little longer so they can be read.
 */
export function Toast({ message, kind = 'info', visible, onHide, duration }: ToastProps) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-140)).current;
  const hold = duration ?? (kind === 'error' ? 5000 : 3000);

  useEffect(() => {
    if (!visible) return;
    Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }).start();
    const timer = setTimeout(() => {
      Animated.timing(translateY, { toValue: -140, duration: 250, useNativeDriver: true }).start(() => onHide());
    }, hold);
    return () => clearTimeout(timer);
  }, [visible, hold, translateY, onHide]);

  if (!visible) return null;
  const k = KIND[kind];

  return (
    <Animated.View
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      style={[styles.container, { top: insets.top + spacing.sm, backgroundColor: k.bg, borderColor: k.fg, transform: [{ translateY }] }]}
    >
      <Ionicons name={k.icon} size={22} color={k.fg} />
      <Text style={[styles.text, { color: k.fg }]} numberOfLines={3}>
        {message}
      </Text>
    </Animated.View>
  );
}

/** Hook for easy usage: `const { toast, show, hide } = useToast()` and render <Toast {...} />. */
export function useToast() {
  const [state, setState] = useState<{ message: string; kind: ToastKind; visible: boolean }>({
    message: '',
    kind: 'info',
    visible: false,
  });

  const show = useCallback((message: string, kind: ToastKind = 'info') => {
    setState({ message, kind, visible: true });
  }, []);

  const hide = useCallback(() => {
    setState((prev) => ({ ...prev, visible: false }));
  }, []);

  return { toast: state, show, hide };
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1.5,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  text: { flex: 1, fontSize: 15, fontWeight: '700', lineHeight: 21 },
});
