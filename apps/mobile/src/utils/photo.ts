import * as ImagePicker from 'expo-image-picker';

export interface PickedPhoto {
  uri: string;
  mimeType: string;
  fileName: string;
}

export type PhotoSource = 'camera' | 'library';

export type PhotoResult =
  | { status: 'ok'; photo: PickedPhoto }
  | { status: 'cancelled' }
  | { status: 'denied' };

/**
 * Opens the camera (default) or the gallery and returns one photo.
 *
 * Staff are standing at the work in front of them, so the camera is the
 * primary path; the gallery is the fallback. Quality 0.7 keeps uploads small
 * on weak mobile data without making site photos unreadable.
 */
export async function pickPhoto(source: PhotoSource = 'camera'): Promise<PhotoResult> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { status: 'denied' };

  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7, exif: false };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return { status: 'cancelled' };

  return {
    status: 'ok',
    photo: {
      uri: asset.uri,
      mimeType: asset.mimeType ?? 'image/jpeg',
      fileName: asset.fileName ?? `photo-${Date.now()}.jpg`,
    },
  };
}
