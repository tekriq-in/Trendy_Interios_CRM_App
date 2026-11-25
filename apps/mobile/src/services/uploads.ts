import { api } from './api';
import type { PickedPhoto } from '../utils/photo';

/**
 * Uploads a photo to the project's documents and returns the new document id.
 * The API stores it (Drive or Cloudinary) and returns the document record; the
 * id is what handovers (`proofFileIds`) and tasks (`photoId`) refer to.
 */
export async function uploadProjectPhoto(
  photo: PickedPhoto,
  projectId: string,
  departmentId?: string,
): Promise<string> {
  const form = new FormData();
  form.append('file', { uri: photo.uri, type: photo.mimeType, name: photo.fileName } as unknown as Blob);
  form.append('projectId', projectId);
  form.append('type', 'photo');
  if (departmentId) form.append('departmentId', departmentId);

  const res = await api.post<{ _id: string }>('/documents/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    // Photos on weak mobile data can be slow; allow more time than the default.
    timeout: 90000,
  });
  return res.data._id;
}
