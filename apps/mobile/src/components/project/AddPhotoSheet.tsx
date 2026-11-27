import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Sheet, TextField } from '../ui';
import { pickPhoto, type PickedPhoto, type PhotoSource } from '../../utils/photo';
import { colors, font, radius, spacing } from '../../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  onUpload: (photo: PickedPhoto, fileName: string) => Promise<boolean>;
}

function extensionOf(fileName: string, mimeType: string): string {
  const match = fileName.match(/\.[^.]+$/);
  if (match) return match[0];
  return mimeType === 'image/png' ? '.png' : '.jpg';
}

export function AddPhotoSheet({ visible, onClose, onUpload }: Props) {
  const { t } = useTranslation();
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [fileName, setFileName] = useState('');
  const [extension, setExtension] = useState('.jpg');
  const [error, setError] = useState('');
  const [picking, setPicking] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (visible) {
      setPhoto(null);
      setFileName('');
      setExtension('.jpg');
      setError('');
      setPicking(false);
      setUploading(false);
    }
  }, [visible]);

  async function choose(source: PhotoSource) {
    setPicking(true);
    setError('');
    try {
      const result = await pickPhoto(source);
      if (result.status === 'denied') {
        setError(t('project.photoPermissionDenied'));
      } else if (result.status === 'ok') {
        const ext = extensionOf(result.photo.fileName, result.photo.mimeType);
        setPhoto(result.photo);
        setExtension(ext);
        setFileName(result.photo.fileName.replace(/\.[^.]+$/, ''));
      }
    } catch {
      setError(t('common.checkConnection'));
    } finally {
      setPicking(false);
    }
  }

  async function upload() {
    if (!photo || !fileName.trim()) {
      setError(t('project.photoNameRequired'));
      return;
    }
    setUploading(true);
    setError('');
    try {
      const saved = await onUpload(photo, `${fileName.trim()}${extension}`);
      if (saved) onClose();
    } finally {
      setUploading(false);
    }
  }

  return (
    <Sheet visible={visible} title={t('project.addPhoto')} onClose={onClose}>
      {!photo ? (
        <View style={styles.choices}>
          <Text style={font.body}>{t('project.choosePhotoSource')}</Text>
          <Button label={t('project.takePhoto')} icon="camera-outline" loading={picking} onPress={() => void choose('camera')} />
          <Button label={t('project.chooseFromGallery')} icon="images-outline" variant="secondary" loading={picking} onPress={() => void choose('library')} />
        </View>
      ) : (
        <View>
          <Image source={{ uri: photo.uri }} style={styles.preview} resizeMode="cover" />
          <TextField
            label={t('project.fileName')}
            value={fileName}
            onChangeText={setFileName}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            editable={!uploading}
            error={error}
            hint={`${t('project.fileNameHint')} ${extension}`}
          />
          <View style={styles.actions}>
            <Button
              label={t('project.chooseDifferentPhoto')}
              variant="secondary"
              disabled={uploading}
              onPress={() => {
                setError('');
                setPhoto(null);
              }}
            />
            <Button label={t('project.uploadPhoto')} icon="cloud-upload-outline" loading={uploading} onPress={() => void upload()} />
          </View>
        </View>
      )}
      {!photo && error ? <Text style={styles.error}>{error}</Text> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  choices: { gap: spacing.md, paddingBottom: spacing.lg },
  preview: { width: '100%', height: 190, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, marginBottom: spacing.lg },
  actions: { gap: spacing.sm, paddingBottom: spacing.lg },
  error: { ...font.caption, color: colors.danger, marginBottom: spacing.sm },
});
