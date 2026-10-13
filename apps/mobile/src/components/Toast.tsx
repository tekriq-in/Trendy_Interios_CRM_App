import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

type ToastKind = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  kind?: ToastKind;
  visible: boolean;
  onHide: () => void;
  duration?: number;
}

const KIND_COLORS: Record<ToastKind, { bg: string; text: string; border: string }> = {
  success: { bg: '#F0FDF4', text: '#15803D', border: '#86EFAC' },
  error: { bg: '#FEF2F2', text: '#DC2626', border: '#FCA5A5' },
  info: { bg: '#EFF6FF', text: '#2563EB', border: '#93C5FD' },
};

export function Toast({ message, kind = 'info', visible, onHide, duration = 3000 }: ToastProps) {
  const translateY = useRef(new Animated.Value(-80)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }).start();

      const timer = setTimeout(() => {
        Animated.timing(translateY, {
          toValue: -80,
          duration: 250,
          useNativeDriver: true,
        }).start(() => onHide());
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible, duration, translateY, onHide]);

  if (!visible) return null;

  const colors = KIND_COLORS[kind];

  return (
    <Animated.View
      style={[
        s.container,
        {
          backgroundColor: colors.bg,
          borderColor: colors.border,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={[s.dot, { backgroundColor: colors.border }]} />
      <Text style={[s.text, { color: colors.text }]} numberOfLines={2}>
        {message}
      </Text>
    </Animated.View>
  );
}

// Hook for easy usage
import { useState, useCallback } from 'react';

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

const s = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 56,
    left: 16,
    right: 16,
    zIndex: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  dot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  text: { flex: 1, fontSize: 14, fontWeight: '500', lineHeight: 20 },
});
