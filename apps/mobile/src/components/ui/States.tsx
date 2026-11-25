import { StyleSheet, Text, View } from 'react-native';
import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, spacing } from '../../theme';
import { Button } from './Button';

type IconName = ComponentProps<typeof Ionicons>['name'];

interface StateProps {
  icon?: IconName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Shown when a list has nothing in it. Says what is missing and, where possible, what to do. */
export function EmptyState({ icon = 'file-tray-outline', title, message, actionLabel, onAction }: StateProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={34} color={colors.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <View style={styles.action}>
          <Button label={actionLabel} onPress={onAction} variant="secondary" block={false} />
        </View>
      ) : null}
    </View>
  );
}

/** Shown when loading failed. Never a silent blank screen: always offers a retry. */
export function ErrorState({
  title,
  message,
  retryLabel,
  onRetry,
}: {
  title: string;
  message?: string;
  retryLabel: string;
  onRetry: () => void;
}) {
  return (
    <View style={styles.wrap}>
      <View style={[styles.iconCircle, { backgroundColor: colors.dangerSoft }]}>
        <Ionicons name="cloud-offline-outline" size={34} color={colors.danger} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      <View style={styles.action}>
        <Button label={retryLabel} onPress={onRetry} icon="refresh" block={false} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: spacing.xl },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: { ...font.h3, textAlign: 'center' },
  message: { ...font.body, color: colors.textSubtle, textAlign: 'center', marginTop: 6 },
  action: { marginTop: spacing.xl },
});
