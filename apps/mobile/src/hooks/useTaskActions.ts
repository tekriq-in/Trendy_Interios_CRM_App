import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { api, describeApiError } from '../services/api';
import { uploadProjectPhoto } from '../services/uploads';
import { enqueue } from '../store/slices/offline-queue.slice';
import { pickPhoto } from '../utils/photo';

type NotifyKind = 'success' | 'error' | 'info';

interface Options {
  /** Called right away so the list can show the new status without waiting for a reload. */
  onStatusChanged: (taskId: string, status: 'in_progress' | 'done') => void;
  /** Called after something changed on the server, so the screen can reload. */
  onReload: () => void;
  notify: (message: string, kind: NotifyKind) => void;
}

/**
 * Start / finish / photo for a task. Shared by the project screen and the Tasks
 * tab so both behave the same, including when there is no signal: a status
 * change or photo is saved to the offline queue and shown as done immediately,
 * then uploaded when the connection returns.
 */
export function useTaskActions({ onStatusChanged, onReload, notify }: Options) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function setStatus(taskId: string, status: 'in_progress' | 'done') {
    setBusyId(taskId);
    try {
      await api.patch(`/tasks/${taskId}`, { status });
      onStatusChanged(taskId, status);
    } catch (err) {
      if (describeApiError(err, '') === 'offline') {
        dispatch(enqueue({ type: 'task_update', payload: { taskId, data: { status } } }));
        onStatusChanged(taskId, status);
        notify(t('task.savedOffline'), 'info');
      } else {
        notify(describeApiError(err, t('common.checkConnection')), 'error');
      }
    } finally {
      setBusyId(null);
    }
  }

  /** Takes a photo and uploads it to the project; attaches it to the task when `taskId` is given. */
  async function addPhoto(opts: { projectId: string; departmentId?: string; taskId?: string }) {
    const result = await pickPhoto('camera');
    if (result.status === 'denied') {
      notify(t('handover.cameraDenied'), 'error');
      return;
    }
    if (result.status !== 'ok') return;

    if (opts.taskId) setBusyId(opts.taskId);
    try {
      const docId = await uploadProjectPhoto(result.photo, opts.projectId, opts.departmentId);
      if (opts.taskId) await api.patch(`/tasks/${opts.taskId}`, { photoId: docId });
      notify(t('project.photoSaved'), 'success');
      onReload();
    } catch (err) {
      if (describeApiError(err, '') === 'offline') {
        // Queued as a project photo; it uploads when the signal is back.
        dispatch(
          enqueue({
            type: 'document_upload',
            payload: {
              uri: result.photo.uri,
              mimeType: result.photo.mimeType,
              fileName: result.photo.fileName,
              projectId: opts.projectId,
              type: 'photo',
            },
          }),
        );
        notify(t('project.photoQueued'), 'info');
      } else {
        notify(describeApiError(err, t('common.checkConnection')), 'error');
      }
    } finally {
      setBusyId(null);
    }
  }

  return { busyId, setStatus, addPhoto };
}
