import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import NetInfo from '@react-native-community/netinfo';
import { api, describeApiError } from '../services/api';
import { uploadProjectPhoto } from '../services/uploads';
import { enqueue } from '../store/slices/offline-queue.slice';
import type { PickedPhoto } from '../utils/photo';

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

  /** Uploads a selected photo using the editable file name from AddPhotoSheet. */
  async function addPhoto(
    opts: { projectId: string; departmentId?: string; taskId?: string },
    photo: PickedPhoto,
    fileName: string,
  ): Promise<boolean> {
    const queuePhoto = () => {
      dispatch(
        enqueue({
          type: 'document_upload',
          payload: {
            uri: photo.uri,
            mimeType: photo.mimeType,
            fileName,
            projectId: opts.projectId,
            departmentId: opts.departmentId,
            type: 'photo',
          },
        }),
      );
      notify(t('project.photoQueued'), 'info');
    };

    // Avoid waiting for the upload timeout when the device already knows it is
    // offline. The queued item immediately appears in the project's pending list.
    const connection = await NetInfo.fetch().catch(() => null);
    if (connection?.isConnected === false || connection?.isInternetReachable === false) {
      queuePhoto();
      return true;
    }

    if (opts.taskId) setBusyId(opts.taskId);
    try {
      const docId = await uploadProjectPhoto({ ...photo, fileName }, opts.projectId, opts.departmentId);
      if (opts.taskId) await api.patch(`/tasks/${opts.taskId}`, { photoId: docId });
      notify(t('project.photoSaved'), 'success');
      onReload();
      return true;
    } catch (err) {
      if (describeApiError(err, '') === 'offline') {
        // The request lost its connection after the preflight check.
        queuePhoto();
        return true;
      } else {
        notify(describeApiError(err, t('common.checkConnection')), 'error');
        return false;
      }
    } finally {
      setBusyId(null);
    }
  }

  return { busyId, setStatus, addPhoto };
}
