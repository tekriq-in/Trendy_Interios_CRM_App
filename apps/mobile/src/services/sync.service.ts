import { store } from '../store';
import { dequeue, incrementRetry } from '../store/slices/offline-queue.slice';
import { api } from './api';

const MAX_RETRIES = 3;

export async function syncOfflineQueue(): Promise<void> {
  const { queue } = store.getState().offlineQueue;

  for (const action of queue) {
    if (action.retries >= MAX_RETRIES) {
      store.dispatch(dequeue(action.id));
      continue;
    }

    try {
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
          });
          break;
        }
      }
      store.dispatch(dequeue(action.id));
    } catch {
      store.dispatch(incrementRetry(action.id));
    }
  }
}
