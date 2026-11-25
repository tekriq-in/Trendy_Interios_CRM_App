import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ComponentProps, ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, font, size, spacing } from '../../theme';
import { OfflineBanner } from '../OfflineBanner';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  /** Show a back arrow that pops the navigation stack. */
  back?: boolean;
  /** Element rendered at the right edge, e.g. an icon button. */
  right?: ReactNode;
}

/**
 * Consistent top bar. Pads for the status bar / notch with the safe-area
 * inset instead of a hard-coded number, so it is right on every phone.
 */
export function ScreenHeader({ title, subtitle, back = false, right }: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  return (
    <View>
    <View style={[styles.wrap, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.row}>
        {back ? (
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(app)/home'))}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={8}
            style={styles.back}
          >
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
        ) : null}
        <View style={styles.titles}>
          <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
    </View>
    <OfflineBanner />
    </View>
  );
}

/** 48dp round icon button for the header's right slot. */
export function HeaderIconButton({
  icon,
  label,
  onPress,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
    >
      <Ionicons name={icon} size={24} color={colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: size.minTap },
  back: { width: size.minTap, height: size.minTap, justifyContent: 'center', marginLeft: -10 },
  titles: { flex: 1 },
  title: { ...font.title, fontSize: 24 },
  subtitle: { ...font.caption, marginTop: 2 },
  right: { marginLeft: spacing.md },
  iconBtn: {
    width: size.minTap,
    height: size.minTap,
    borderRadius: size.minTap / 2,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
