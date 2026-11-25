import axios from 'axios';
import { store } from '../store';
import { dequeue, incrementRetry, markFailed, type QueuedAction } from '../store/slices/offline-queue.slice';
import { api } from './api';

/** After this many server errors in a row the action is kept but marked failed. */
const MAX_RETRIES = 5;

let running = false;

async function send(action: QueuedAction): Promise<void> {
  switch (action.type) {
    case 'task_update':
      await api.patch(`/tasks/${action.payload.taskId}`, action.payload.data);
      break;
    case 'task_create':
      await api.post(`/projects/${action.payload.projectId}/tasks`, action.payload.data);
      break;
    case 'document_upload': {
      const form = new FormData();
      form.append('file', {
        uri: action.payload.uri as string,
        type: action.payload.mimeType as string,
        name: action.payload.fileName as string,
      } as unknown as Blob);
      if (action.payload.projectId) form.append('projectId', action.payload.projectId as string);
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
  if (running) return;
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
  }
}
