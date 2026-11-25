import { api } from './api';
import type { PickedPhoto } from '../utils/photo';

interface UploadedDocument {
  _id: string;
  driveLink: string;
}

async function postPhoto(photo: PickedPhoto, fields: Record<string, string | undefined>): Promise<UploadedDocument> {
  const form = new FormData();
  form.append('file', { uri: photo.uri, type: photo.mimeType, name: photo.fileName } as unknown as Blob);
  for (const [key, value] of Object.entries(fields)) {
    if (value) form.append(key, value);
  }
  const res = await api.post<UploadedDocument>('/documents/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    // Photos on weak mobile data can be slow; allow more time than the default.
    timeout: 90000,
  });
  return res.data;
}

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
  const doc = await postPhoto(photo, { projectId, departmentId, type: 'photo' });
  return doc._id;
}

/** Uploads a photo shared in chat (not tied to a project) and returns its link. */
export async function uploadChatPhoto(photo: PickedPhoto): Promise<string> {
  const doc = await postPhoto(photo, { type: 'photo' });
  return doc.driveLink;
}
