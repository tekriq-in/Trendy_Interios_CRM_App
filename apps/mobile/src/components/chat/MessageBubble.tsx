import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import type { ChatMessage } from '@ti/shared';
import type { PickedPhoto } from '../../utils/photo';
import { colors, radius } from '../../theme';
import { formatTime } from '../../utils/format';

/** Body used for a photo sent without a caption (the server requires a non-empty body). */
export const PHOTO_BODY = '📷';

/** A message in the thread, possibly still being sent or failed. */
export type LocalMessage = ChatMessage & {
  _failed?: boolean;
  /** Original photo, kept so a failed photo send can be retried. */
  _photo?: PickedPhoto;
};

export const senderName = (m: ChatMessage): string =>
  typeof m.sender === 'object' && m.sender ? (m.sender.name ?? '') : '';

export const senderId = (m: ChatMessage): string =>
  typeof m.sender === 'object' && m.sender ? m.sender._id : String(m.sender);

interface Props {
  msg: LocalMessage;
  isOwn: boolean;
  showSender: boolean;
  onRetry: () => void;
  onRemove: () => void;
  onOpenImage: (url: string) => void;
}

/**
 * One chat message. Own messages are on the right in the brand colour. While a
 * message is being sent it is dimmed; if sending fails it turns into a clear
 * "Not sent. Tap to retry" so nothing is lost silently (the old screen left a
 * failed message showing "…" forever).
 */
export function MessageBubble({ msg, isOwn, showSender, onRetry, onRemove, onOpenImage }: Props) {
  const { t, i18n } = useTranslation();
  const isImage = msg.mediaType === 'image' && !!msg.mediaUrl;
  const caption = msg.body && msg.body !== PHOTO_BODY ? msg.body : '';

  return (
    <View style={[styles.wrap, isOwn ? styles.own : styles.other]}>
      {!isOwn && showSender ? <Text style={styles.sender}>{senderName(msg)}</Text> : null}

      <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther, msg._sending && styles.sending]}>
        {isImage ? (
          <Pressable
            onPress={() => onOpenImage(msg.mediaUrl as string)}
            accessibilityRole="imagebutton"
            accessibilityLabel={t('chat.photo')}
          >
            <Image source={{ uri: msg.mediaUrl as string }} style={styles.image} resizeMode="cover" />
          </Pressable>
        ) : null}
        {caption ? <Text style={isOwn ? styles.textOwn : styles.textOther}>{caption}</Text> : null}
        {!isImage && !caption ? <Text style={isOwn ? styles.textOwn : styles.textOther}>{msg.body}</Text> : null}

        {msg._failed ? null : (
          <Text style={[styles.time, isOwn ? styles.timeOwn : styles.timeOther]}>
            {msg._sending ? t('chat.sending') : formatTime(msg.createdAt, i18n.language)}
          </Text>
        )}
      </View>

      {msg._failed ? (
        <View style={styles.failedRow}>
          <Pressable onPress={onRetry} accessibilityRole="button" accessibilityLabel={t('chat.retry')} style={styles.failedBtn}>
            <Ionicons name="alert-circle" size={18} color={colors.danger} />
            <Text style={styles.failedText}>{t('chat.failed')}</Text>
          </Pressable>
          <Pressable onPress={onRemove} accessibilityRole="button" accessibilityLabel={t('chat.remove')} style={styles.removeBtn}>
            <Ionicons name="trash-outline" size={20} color={colors.textSubtle} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginVertical: 3, paddingHorizontal: 16, maxWidth: '84%' },
  own: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  other: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  sender: { fontSize: 12, fontWeight: '800', color: colors.primary, marginBottom: 3, marginLeft: 4 },
  bubble: { borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 10, overflow: 'hidden' },
  bubbleOwn: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  sending: { opacity: 0.65 },
  image: { width: 220, height: 220, borderRadius: radius.md, marginBottom: 6, backgroundColor: colors.neutralSoft },
  textOwn: { fontSize: 16, color: colors.onPrimary, lineHeight: 22 },
  textOther: { fontSize: 16, color: colors.text, lineHeight: 22 },
  time: { fontSize: 11, marginTop: 4, alignSelf: 'flex-end' },
  timeOwn: { color: 'rgba(255,255,255,0.75)' },
  timeOther: { color: colors.textSubtle },
  failedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  failedBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, justifyContent: 'center' },
  failedText: { color: colors.danger, fontSize: 13, fontWeight: '700' },
  removeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
