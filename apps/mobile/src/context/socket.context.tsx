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
  sendMessage: (channel: string, body: string, attachments?: string[]) => void;
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
  sendMessage: () => {},
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
  // Active channel — used to skip incrementing unread when channel is open
  const activeChannelRef = useRef<string | null>(null);

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

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('message', (msg: ChatMessage) => {
      const channel = msg.channel;
      if (channel && channel !== activeChannelRef.current) {
        setUnreadMap((prev) => ({ ...prev, [channel]: (prev[channel] ?? 0) + 1 }));
      }
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

  const sendMessage = useCallback((channel: string, body: string, attachments?: string[]) => {
    socketRef.current?.emit('message', { channel, body, attachments: attachments ?? [] });
  }, []);

  const markRead = useCallback((channel: string) => {
    socketRef.current?.emit('mark_read', { channel });
    setUnreadMap((prev) => ({ ...prev, [channel]: 0 }));
  }, []);

  const clearUnread = useCallback((channel: string) => {
    setUnreadMap((prev) => ({ ...prev, [channel]: 0 }));
  }, []);

  const onMessage = useCallback((handler: (msg: ChatMessage) => void) => {
    socketRef.current?.on('message', handler);
    return () => {
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
