import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { randomUUID } from 'expo-crypto';

export interface QueuedAction {
  id: string;
  type: 'task_update' | 'task_create' | 'document_upload';
  payload: Record<string, unknown>;
  createdAt: string;
  retries: number;
  /**
   * True once the server has rejected the action for good, or it failed too many
   * times. A failed action is KEPT (never silently dropped) and shown to the user,
   * who can retry or discard it.
   */
  failed?: boolean;
}

interface OfflineQueueState {
  queue: QueuedAction[];
}

const initialState: OfflineQueueState = { queue: [] };

export const offlineQueueSlice = createSlice({
  name: 'offlineQueue',
  initialState,
  reducers: {
    enqueue: (state, action: PayloadAction<Omit<QueuedAction, 'id' | 'createdAt' | 'retries' | 'failed'>>) => {
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
    markFailed: (state, action: PayloadAction<string>) => {
      const item = state.queue.find((i) => i.id === action.payload);
      if (item) item.failed = true;
    },
    /** Gives every failed action a fresh start (the user chose "Retry"). */
    retryFailed: (state) => {
      state.queue.forEach((item) => {
        if (item.failed) {
          item.failed = false;
          item.retries = 0;
        }
      });
    },
    /** Removes the failed actions (the user chose "Discard"). */
    discardFailed: (state) => {
      state.queue = state.queue.filter((item) => !item.failed);
    },
    clearQueue: (state) => {
      state.queue = [];
    },
  },
});

export const { enqueue, dequeue, incrementRetry, markFailed, retryFailed, discardFailed, clearQueue } =
  offlineQueueSlice.actions;
export default offlineQueueSlice.reducer;
