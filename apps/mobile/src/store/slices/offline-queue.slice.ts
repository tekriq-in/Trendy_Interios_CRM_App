import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { randomUUID } from 'expo-crypto';

export interface QueuedAction {
  id: string;
  type: 'task_update' | 'task_create' | 'document_upload';
  payload: Record<string, unknown>;
  createdAt: string;
  retries: number;
}

interface OfflineQueueState {
  queue: QueuedAction[];
}

const initialState: OfflineQueueState = { queue: [] };

export const offlineQueueSlice = createSlice({
  name: 'offlineQueue',
  initialState,
  reducers: {
    enqueue: (state, action: PayloadAction<Omit<QueuedAction, 'id' | 'createdAt' | 'retries'>>) => {
      state.queue.push({
        ...action.payload,
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        retries: 0,
      });
    },
    dequeue: (state, action: PayloadAction<string>) => {
      state.queue = state.queue.filter((item) => item.id !== action.payload);
    },
    incrementRetry: (state, action: PayloadAction<string>) => {
      const item = state.queue.find((i) => i.id === action.payload);
      if (item) item.retries += 1;
    },
    clearQueue: (state) => {
      state.queue = [];
    },
  },
});

export const { enqueue, dequeue, incrementRetry, clearQueue } = offlineQueueSlice.actions;
export default offlineQueueSlice.reducer;
