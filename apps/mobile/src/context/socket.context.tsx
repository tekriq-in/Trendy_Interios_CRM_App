import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import type { ChatMessage } from '@ti/shared';

const WS_URL = process.env.EXPO_PUBLIC_WS_URL ?? 'http://localhost:3001';

interface SocketContextValue {
  socket: Socket | null;
  connected: boolean;
  joinChannel: (channel: string) => void;
  leaveChannel: (channel: string) => void;
  /**
   * Sends a message and resolves with the saved message once the server confirms
   * it (the gateway returns it as the acknowledgement). Rejects when offline or
   * when no confirmation arrives in time, so the UI can show "failed, tap to retry".
   */
  sendMessage: (
    channel: string,
    body: string,
    extra?: { attachments?: string[]; mediaType?: 'image'; mediaUrl?: string },
  ) => Promise<ChatMessage>;
  markRead: (channel: string) => void;
  unreadMap: Record<string, number>;
  clearUnread: (channel: string) => void;
  onMessage: (handler: (msg: ChatMessage) => void) => () => void;
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  connected: false,
  joinChannel: () => {},
  leaveChannel: () => {},
  sendMessage: () => Promise.reject(new Error('socket unavailable')),
  markRead: () => {},
  unreadMap: {},
  clearUnread: () => {},
  onMessage: () => () => {},
});

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const token = useSelector((s: RootState) => s.auth.accessToken);
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});
  const activeChannelRef = useRef<string | null>(null);
  // Persistent set of external message handlers — re-attached after every reconnect
  const messageHandlersRef = useRef<Set<(msg: ChatMessage) => void>>(new Set());

  useEffect(() => {
    if (!token) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setConnected(false);
      return;
    }

    const socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    function attachHandlers() {
      // Unread counter (always active)
      socket.on('message', (msg: ChatMessage) => {
        const channel = msg.channel;
        if (channel && channel !== activeChannelRef.current) {
          setUnreadMap((prev) => ({ ...prev, [channel]: (prev[channel] ?? 0) + 1 }));
        }
      });
      // Re-attach all external handlers registered via onMessage()
      messageHandlersRef.current.forEach((h) => socket.on('message', h));
    }

    socket.on('connect', () => {
      setConnected(true);
      // Re-attach after every reconnect so handlers survive disconnects
      attachHandlers();
    });
    socket.on('disconnect', () => {
      setConnected(false);
      // Remove all listeners — they'll be re-added on the next connect event
      socket.removeAllListeners('message');
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [token]);

  const joinChannel = useCallback((channel: string) => {
    activeChannelRef.current = channel;
    socketRef.current?.emit('join_channel', channel);
  }, []);

  const leaveChannel = useCallback((channel: string) => {
    if (activeChannelRef.current === channel) activeChannelRef.current = null;
    socketRef.current?.emit('leave_channel', channel);
  }, []);

  const sendMessage = useCallback<SocketContextValue['sendMessage']>((channel, body, extra) => {
    return new Promise<ChatMessage>((resolve, reject) => {
      const socket = socketRef.current;
      // Fail fast when offline instead of letting socket.io queue it invisibly.
      if (!socket || !socket.connected) {
        reject(new Error('offline'));
        return;
      }
      socket
        .timeout(10000)
        .emit('message', { channel, body, attachments: extra?.attachments ?? [], mediaType: extra?.mediaType, mediaUrl: extra?.mediaUrl }, (err: Error | null, saved?: ChatMessage) => {
          if (err || !saved) reject(err ?? new Error('no confirmation'));
          else resolve(saved);
        });
    });
  }, []);

  const markRead = useCallback((channel: string) => {
    socketRef.current?.emit('mark_read', { channel });
    setUnreadMap((prev) => ({ ...prev, [channel]: 0 }));
  }, []);

  const clearUnread = useCallback((channel: string) => {
    setUnreadMap((prev) => ({ ...prev, [channel]: 0 }));
  }, []);

  const onMessage = useCallback((handler: (msg: ChatMessage) => void) => {
    messageHandlersRef.current.add(handler);
    // If socket is already connected, attach immediately
    if (socketRef.current?.connected) {
      socketRef.current.on('message', handler);
    }
    return () => {
      messageHandlersRef.current.delete(handler);
      socketRef.current?.off('message', handler);
    };
  }, []);

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        connected,
        joinChannel,
        leaveChannel,
        sendMessage,
        markRead,
        unreadMap,
        clearUnread,
        onMessage,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
