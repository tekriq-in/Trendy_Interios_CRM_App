'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth.store';

interface ChatMessage {
  _id?: string;
  channel: string;
  body: string;
  sender: { _id: string; name: string; email: string } | string;
  createdAt?: string;
}

export function ProjectChat({ projectId }: { projectId: string }) {
  const channel = `project:${projectId}`;
  const accessToken = useAuthStore((s) => s.accessToken);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [body, setBody] = useState('');
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load history
    apiClient
      .get<{ data: ChatMessage[] }>(`/messages/${encodeURIComponent(channel)}`)
      .then((r) => setMessages(r.data.data.reverse()))
      .catch(() => {});

    // Connect socket
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3001';
    const socket = io(wsUrl, { auth: { token: accessToken }, transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join_channel', channel);
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('message', (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
    });

    return () => {
      socket.disconnect();
    };
  }, [projectId, accessToken, channel]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = () => {
    if (!body.trim() || !socketRef.current) return;
    socketRef.current.emit('message', { channel, body: body.trim() });
    setBody('');
  };

  const senderName = (msg: ChatMessage) => {
    if (typeof msg.sender === 'object') return msg.sender.name || msg.sender.email;
    return 'User';
  };

  return (
    <div className="flex flex-col h-80 border border-gray-200 rounded-lg bg-white overflow-hidden">
      <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between bg-gray-50">
        <span className="text-xs font-medium text-gray-700">Project Chat</span>
        <span className={`text-xs ${connected ? 'text-green-600' : 'text-gray-400'}`}>
          {connected ? 'Connected' : 'Connecting…'}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {messages.map((msg, i) => (
          <div key={msg._id ?? i} className="text-sm">
            <span className="font-medium text-gray-700 text-xs">{senderName(msg)}</span>
            {msg.createdAt && (
              <span className="text-gray-400 text-xs ml-1">
                {new Date(msg.createdAt).toLocaleTimeString()}
              </span>
            )}
            <p className="text-gray-800 mt-0.5">{msg.body}</p>
          </div>
        ))}
        {messages.length === 0 && (
          <p className="text-xs text-gray-400 text-center mt-4">No messages yet.</p>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-3 py-2 border-t border-gray-100 flex gap-2">
        <input
          className="flex-1 border border-gray-300 rounded px-3 py-1 text-sm"
          placeholder="Type a message…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
        />
        <button
          onClick={send}
          disabled={!body.trim() || !connected}
          className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
