import axios from 'axios';
import { store } from '../store';
import {
  dequeue,
  incrementRetry,
  markFailed,
  retryItem,
  updatePayload,
  type QueuedAction,
} from '../store/slices/offline-queue.slice';
import { api } from './api';

interface QueuedProofPhoto {
  uri: string;
  mimeType: string;
  fileName: string;
}

/** After this many server errors in a row the action is kept but marked failed. */
const MAX_RETRIES = 5;

let running = false;
let rerunRequested = false;

async function send(action: QueuedAction): Promise<void> {
  switch (action.type) {
    case 'task_update':
      await api.patch(`/tasks/${action.payload.taskId}`, action.payload.data);
      break;
    case 'task_create':
      await api.post(`/projects/${action.payload.projectId}/tasks`, action.payload.data);
      break;
    case 'blocker_create':
      await api.post('/blockers', action.payload);
      break;
    case 'handover_create': {
      const photos = Array.isArray(action.payload.proofPhotos)
        ? (action.payload.proofPhotos as QueuedProofPhoto[])
        : [];
      const proofFileIds = Array.isArray(action.payload.proofFileIds)
        ? [...(action.payload.proofFileIds as string[])]
        : [];
      const projectId = action.payload.projectId as string;
      const departmentId = action.payload.fromDepartmentId as string;

      // Persist each uploaded id immediately so a later photo or handover retry
      // does not upload proof files that already reached the server.
      for (let i = proofFileIds.length; i < photos.length; i += 1) {
        const photo = photos[i];
        const form = new FormData();
        form.append('file', { uri: photo.uri, type: photo.mimeType, name: photo.fileName } as unknown as Blob);
        form.append('projectId', projectId);
        form.append('departmentId', departmentId);
        form.append('type', 'photo');
        const uploaded = await api.post<{ _id: string }>('/documents/upload', form, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 90000,
        });
        proofFileIds.push(uploaded.data._id);
        store.dispatch(updatePayload({ id: action.id, payload: { proofFileIds: [...proofFileIds] } }));
      }

      const { proofPhotos: _proofPhotos, proofFileIds: _proofFileIds, ...handover } = action.payload;
      await api.post('/handovers', { ...handover, proofFileIds });
      break;
    }
    case 'document_upload': {
      const form = new FormData();
      form.append('file', {
        uri: action.payload.uri as string,
        type: action.payload.mimeType as string,
        name: action.payload.fileName as string,
      } as unknown as Blob);
      if (action.payload.projectId) form.append('projectId', action.payload.projectId as string);
      if (action.payload.departmentId) form.append('departmentId', action.payload.departmentId as string);
      if (action.payload.type) form.append('type', action.payload.type as string);
      await api.post('/documents/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 90000,
      });
      break;
    }
  }
}

/**
 * Uploads queued changes in order. Runs one pass at a time (reconnect events can
 * fire in bursts). Three kinds of outcome:
 *  - success: the action is removed;
 *  - no response (offline): stop and leave everything queued, without using up
 *    retries, because nothing is wrong with the action itself;
 *  - the server rejected it (4xx) or it keeps failing (5xx): mark it failed and
 *    keep it, so the user can retry or discard it. It is never silently deleted.
 */
export async function syncOfflineQueue(): Promise<void> {
  if (running) {
    rerunRequested = true;
    return;
  }
  running = true;
  try {
    for (const action of [...store.getState().offlineQueue.queue]) {
      if (action.failed) continue;
      try {
        await send(action);
        store.dispatch(dequeue(action.id));
      } catch (err) {
        if (axios.isAxiosError(err) && !err.response) return; // offline: try again later
        const status = axios.isAxiosError(err) ? err.response?.status : undefined;
        // 401: the session expired (the API client already tried to refresh it). That is not
        // a problem with this action, so stop and let it go out after the next sign-in.
        if (status === 401) return;
        if (status !== undefined && status >= 400 && status < 500 && status !== 408 && status !== 429) {
          store.dispatch(markFailed(action.id)); // the server will never accept this as-is
        } else {
          store.dispatch(incrementRetry(action.id));
          if (action.retries + 1 >= MAX_RETRIES) store.dispatch(markFailed(action.id));
        }
      }
    }
  } finally {
    running = false;
    if (rerunRequested) {
      rerunRequested = false;
      void syncOfflineQueue();
    }
  }
}

/** Retry one queued item from its pending-photo card. */
export async function retryQueuedAction(id: string): Promise<void> {
  store.dispatch(retryItem(id));
  await syncOfflineQueue();
}
