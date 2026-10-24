'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  MessageSquare,
  Plus,
  Search,
  Send,
  X,
  Users,
  FolderKanban,
  Building2,
  User,
  Paperclip,
  ImageIcon,
  Mic,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth.store';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ChatGroup {
  _id: string;
  name: string;
  type: 'department' | 'project' | 'individual' | 'custom';
  channel: string;
  members: { _id: string; name: string; email: string }[];
  projectRef?: { _id: string; title: string };
  departmentRef?: { _id: string; name: string };
}

interface ChatMessage {
  _id?: string;
  channel: string;
  body: string;
  sender: { _id: string; name: string; email: string } | string;
  mentions?: { _id: string; name: string }[];
  mediaType?: 'image' | 'video' | 'audio' | 'file' | null;
  mediaUrl?: string | null;
  attachments?: { _id: string; fileName: string; driveLink: string }[];
  createdAt?: string;
}

interface UserSummary {
  _id: string;
  name: string;
  email: string;
}

// ─── Tab icons ───────────────────────────────────────────────────────────────

const TAB_ICONS = {
  department: Building2,
  project: FolderKanban,
  individual: User,
  custom: Users,
} as const;

const TAB_LABELS = {
  department: 'Departments',
  project: 'Projects',
  individual: 'Direct Messages',
  custom: 'Groups',
} as const;

const TAB_ORDER: (keyof typeof TAB_LABELS)[] = ['department', 'project', 'individual', 'custom'];

// ─── @mention autocomplete hook ─────────────────────────────────────────────

function useMentionSuggestions(text: string, members: UserSummary[]) {
  const lastAt = text.lastIndexOf('@');
  if (lastAt === -1) return { suggestions: [], query: '', atIndex: -1 };
  const after = text.slice(lastAt + 1);
  if (after.includes(' ') && after.length > 0) return { suggestions: [], query: '', atIndex: -1 };
  const query = after.toLowerCase();
  const suggestions = members.filter(
    (m) => m.name.toLowerCase().includes(query) && query.length >= 1,
  );
  return { suggestions, query, atIndex: lastAt };
}

// ─── New Group Modal ─────────────────────────────────────────────────────────

function NewGroupModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (g: ChatGroup) => void;
}) {
  const [name, setName] = useState('');
  const [memberInput, setMemberInput] = useState('');
  const [allUsers, setAllUsers] = useState<UserSummary[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    apiClient
      .get<{ data: UserSummary[] }>('/users?limit=200')
      .then((r) => setAllUsers(r.data.data ?? []))
      .catch(() => {});
  }, []);

  const filtered = allUsers.filter(
    (u) =>
      u.name.toLowerCase().includes(memberInput.toLowerCase()) &&
      !selectedIds.includes(u._id),
  );

  const createMut = useMutation({
    mutationFn: () =>
      apiClient.post<ChatGroup>('/chat-groups', { name, memberIds: selectedIds }).then((r) => r.data),
    onSuccess: (group) => onCreated(group),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Create Group</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Group Name</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Design Team Alpha"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Add Members</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={memberInput}
              onChange={(e) => setMemberInput(e.target.value)}
              placeholder="Search employees…"
            />
            {memberInput && filtered.length > 0 && (
              <div className="mt-1 border border-gray-200 rounded-lg max-h-36 overflow-y-auto">
                {filtered.slice(0, 10).map((u) => (
                  <button
                    key={u._id}
                    onClick={() => {
                      setSelectedIds((prev) => [...prev, u._id]);
                      setMemberInput('');
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                  >
                    {u.name}
                    <span className="text-gray-400 ml-1 text-xs">{u.email}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedIds.map((id) => {
                const u = allUsers.find((x) => x._id === id);
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 rounded-full px-2.5 py-0.5 text-xs"
                  >
                    {u?.name ?? id}
                    <button onClick={() => setSelectedIds((p) => p.filter((x) => x !== id))}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-6 flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => createMut.mutate()}
            disabled={!name.trim() || createMut.isPending}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {createMut.isPending ? 'Creating…' : 'Create Group'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Chat Page ──────────────────────────────────────────────────────────

export default function ChatPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const currentUser = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const [activeGroup, setActiveGroup] = useState<ChatGroup | null>(null);
  const [activeTab, setActiveTab] = useState<keyof typeof TAB_LABELS>('project');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [body, setBody] = useState('');
  const [connected, setConnected] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [addMemberSearch, setAddMemberSearch] = useState('');
  const [allUsers, setAllUsers] = useState<UserSummary[]>([]);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevChannelRef = useRef<string>('');

  // Load all groups
  const { data: groupsData, refetch: refetchGroups } = useQuery({
    queryKey: ['chat-groups'],
    queryFn: () => apiClient.get<ChatGroup[]>('/chat-groups').then((r) => r.data),
  });
  const groups: ChatGroup[] = groupsData ?? [];

  // Load all users for @mention and member management
  useEffect(() => {
    apiClient
      .get<{ data: UserSummary[] }>('/users?limit=200')
      .then((r) => setAllUsers(r.data.data ?? []))
      .catch(() => {});
  }, []);

  // Socket setup
  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3001';
    const socket = io(wsUrl, { auth: { token: accessToken }, transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('message', (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
    });
    socket.on('group_member_added', () => refetchGroups());
    socket.on('group_member_removed', () => refetchGroups());

    return () => {
      socket.disconnect();
    };
  }, [accessToken, refetchGroups]);

  // Switch channel when activeGroup changes
  useEffect(() => {
    if (!activeGroup) return;
    const socket = socketRef.current;
    if (!socket) return;

    // Leave previous channel
    if (prevChannelRef.current && prevChannelRef.current !== activeGroup.channel) {
      socket.emit('leave_channel', prevChannelRef.current);
    }

    // Load history
    setMessages([]);
    apiClient
      .get<{ data: ChatMessage[] }>(`/messages/${encodeURIComponent(activeGroup.channel)}`)
      .then((r) => setMessages(r.data.data.reverse()))
      .catch(() => {});

    socket.emit('join_channel', activeGroup.channel);
    prevChannelRef.current = activeGroup.channel;
  }, [activeGroup]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // @mention autocomplete
  const members: UserSummary[] = activeGroup?.members ?? [];
  const { suggestions, atIndex } = useMentionSuggestions(body, members);

  const insertMention = (user: UserSummary) => {
    const before = body.slice(0, atIndex);
    const after = body.slice(atIndex + 1 + body.slice(atIndex + 1).length);
    setBody(`${before}@${user.name} ${after}`);
  };

  const sendMessage = useCallback(() => {
    if (!body.trim() || !socketRef.current || !activeGroup) return;
    socketRef.current.emit('message', {
      channel: activeGroup.channel,
      body: body.trim(),
    });
    setBody('');
  }, [body, activeGroup]);

  const handleFileUpload = async (file: File) => {
    if (!activeGroup) return;
    const fd = new FormData();
    fd.append('file', file);
    if (activeGroup.projectRef?._id) fd.append('projectId', activeGroup.projectRef._id);
    fd.append('type', file.type.startsWith('image/') ? 'photo' : 'other');

    try {
      const res = await apiClient.post<{ driveLink: string; _id: string }>('/documents/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const mediaType = file.type.startsWith('image/')
        ? 'image'
        : file.type.startsWith('video/')
        ? 'video'
        : file.type.startsWith('audio/')
        ? 'audio'
        : 'file';

      socketRef.current?.emit('message', {
        channel: activeGroup.channel,
        body: file.name,
        attachments: [res.data._id],
        mediaType,
        mediaUrl: res.data.driveLink,
      });
    } catch {
      // ignore
    }
  };

  const addMemberMut = useMutation({
    mutationFn: (userId: string) =>
      apiClient
        .post(`/chat-groups/${activeGroup!._id}/members`, { userId })
        .then((r) => r.data),
    onSuccess: () => {
      refetchGroups();
      setShowAddMember(false);
    },
  });

  const removeMemberMut = useMutation({
    mutationFn: (userId: string) =>
      apiClient.delete(`/chat-groups/${activeGroup!._id}/members/${userId}`),
    onSuccess: () => refetchGroups(),
  });

  const filteredGroups = groups
    .filter((g) => g.type === activeTab)
    .filter((g) =>
      sidebarSearch
        ? g.name.toLowerCase().includes(sidebarSearch.toLowerCase())
        : true,
    );

  const senderName = (msg: ChatMessage) => {
    if (typeof msg.sender === 'object') return msg.sender.name || msg.sender.email;
    return 'User';
  };

  const isMe = (msg: ChatMessage) => {
    if (typeof msg.sender === 'object') return msg.sender._id === currentUser?.id;
    return msg.sender === currentUser?.id;
  };

  const renderMediaPreview = (msg: ChatMessage) => {
    if (!msg.mediaUrl) return null;
    if (msg.mediaType === 'image') {
      return (
        <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" className="block mt-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={msg.mediaUrl} alt={msg.body} className="max-w-xs max-h-48 rounded-lg object-cover" />
        </a>
      );
    }
    if (msg.mediaType === 'video') {
      return (
        <video controls className="max-w-xs max-h-48 rounded-lg mt-1">
          <source src={msg.mediaUrl} />
        </video>
      );
    }
    if (msg.mediaType === 'audio') {
      return <audio controls src={msg.mediaUrl} className="mt-1 w-56" />;
    }
    return (
      <a
        href={msg.mediaUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 inline-flex items-center gap-1 text-xs text-indigo-600 underline"
      >
        <Paperclip className="w-3 h-3" /> {msg.body}
      </a>
    );
  };

  const renderBody = (msg: ChatMessage) => {
    if (!msg.body) return null;
    const parts = msg.body.split(/(@[\w\s]+?(?=\s|$|@))/g);
    return (
      <p className="mt-0.5 whitespace-pre-wrap break-words">
        {parts.map((part, i) =>
          part.startsWith('@') ? (
            <span key={i} className="text-indigo-600 font-medium">
              {part}
            </span>
          ) : (
            part
          ),
        )}
      </p>
    );
  };

  return (
    <div className="flex h-[calc(100vh-5rem)] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className="w-72 shrink-0 border-r border-gray-100 flex flex-col bg-gray-50">
        {/* Header */}
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900 text-sm">Chat</h2>
            <div className="flex gap-1.5">
              <button
                title="New group"
                onClick={() => setShowNewGroup(true)}
                className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500 hover:text-gray-700"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white"
              placeholder="Search conversations…"
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Type tabs */}
        <div className="flex border-b border-gray-100 bg-white overflow-x-auto">
          {TAB_ORDER.map((tab) => {
            const Icon = TAB_ICONS[tab];
            const count = groups.filter((g) => g.type === tab).length;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-1 px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {count > 0 && (
                  <span className="ml-0.5 bg-gray-200 text-gray-600 rounded-full px-1.5 py-0 text-[10px]">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Group list */}
        <div className="flex-1 overflow-y-auto py-2">
          {filteredGroups.length === 0 && (
            <p className="text-xs text-gray-400 text-center mt-6 px-4">
              {activeTab === 'department'
                ? 'No department groups yet.'
                : activeTab === 'project'
                ? 'No project chats yet. Create a project to get started.'
                : activeTab === 'individual'
                ? 'No direct messages yet.'
                : 'No custom groups. Click + to create one.'}
            </p>
          )}
          {filteredGroups.map((group) => {
            const active = activeGroup?._id === group._id;
            const Icon = TAB_ICONS[group.type];
            return (
              <button
                key={group._id}
                onClick={() => setActiveGroup(group)}
                className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors ${
                  active ? 'bg-indigo-50' : 'hover:bg-gray-100'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold ${
                    active ? 'bg-indigo-500' : 'bg-gray-400'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p
                    className={`text-sm font-medium truncate ${
                      active ? 'text-indigo-700' : 'text-gray-800'
                    }`}
                  >
                    {group.name}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {group.members.length} member{group.members.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* ── Main chat area ───────────────────────────────────────────────── */}
      {!activeGroup ? (
        <div className="flex-1 flex items-center justify-center flex-col gap-3 text-gray-400">
          <MessageSquare className="w-12 h-12 text-gray-200" />
          <p className="text-sm">Select a conversation to start chatting</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Chat header */}
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-white">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-indigo-500 flex items-center justify-center text-white">
                {(() => {
                  const Icon = TAB_ICONS[activeGroup.type];
                  return <Icon className="w-4 h-4" />;
                })()}
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">{activeGroup.name}</p>
                <p className="text-xs text-gray-400">
                  {activeGroup.members.length} member{activeGroup.members.length !== 1 ? 's' : ''}
                  {' · '}
                  <span className={connected ? 'text-green-500' : 'text-gray-300'}>
                    {connected ? 'Connected' : 'Connecting…'}
                  </span>
                </p>
              </div>
            </div>
            {(activeGroup.type === 'custom' || activeGroup.type === 'project') && (
              <button
                onClick={() => setShowAddMember(true)}
                className="flex items-center gap-1.5 text-xs text-indigo-600 border border-indigo-200 rounded-lg px-3 py-1.5 hover:bg-indigo-50"
              >
                <Users className="w-3.5 h-3.5" />
                Members
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {messages.map((msg, i) => {
              const mine = isMe(msg);
              return (
                <div key={msg._id ?? i} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[70%] rounded-2xl px-4 py-2.5 shadow-sm ${
                      mine
                        ? 'bg-indigo-600 text-white rounded-br-none'
                        : 'bg-white border border-gray-100 text-gray-800 rounded-bl-none'
                    }`}
                  >
                    {!mine && (
                      <p className={`text-[10px] font-semibold mb-0.5 ${mine ? 'text-indigo-200' : 'text-indigo-600'}`}>
                        {senderName(msg)}
                      </p>
                    )}
                    {msg.mediaType ? (
                      <div>{renderMediaPreview(msg)}</div>
                    ) : (
                      <div className={`text-sm ${mine ? 'text-white' : 'text-gray-800'}`}>
                        {renderBody(msg)}
                      </div>
                    )}
                    {msg.createdAt && (
                      <p
                        className={`text-[10px] mt-1 text-right ${
                          mine ? 'text-indigo-200' : 'text-gray-400'
                        }`}
                      >
                        {new Date(msg.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
            {messages.length === 0 && (
              <p className="text-center text-sm text-gray-400 mt-8">
                No messages yet — be the first to say something!
              </p>
            )}
            <div ref={bottomRef} />
          </div>

          {/* @mention suggestions */}
          {suggestions.length > 0 && (
            <div className="mx-5 mb-1 border border-gray-200 rounded-lg bg-white shadow-lg overflow-hidden z-10">
              {suggestions.slice(0, 5).map((u) => (
                <button
                  key={u._id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertMention(u);
                  }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-indigo-50 flex items-center gap-2"
                >
                  <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                    {u.name[0]}
                  </div>
                  <span className="font-medium">{u.name}</span>
                  <span className="text-gray-400 text-xs">{u.email}</span>
                </button>
              ))}
            </div>
          )}

          {/* Input area */}
          <div className="px-5 py-3 border-t border-gray-100 bg-white">
            <div className="flex items-end gap-2">
              <div className="flex gap-1 shrink-0">
                <button
                  title="Attach image / video / audio"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                >
                  <ImageIcon className="w-4 h-4" />
                </button>
                <button
                  title="Attach file"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <button
                  title="Audio note"
                  className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                >
                  <Mic className="w-4 h-4" />
                </button>
              </div>
              <textarea
                rows={1}
                className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm resize-none focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                placeholder={`Message ${activeGroup.name}… (type @ to mention)`}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
              />
              <button
                onClick={sendMessage}
                disabled={!body.trim() || !connected}
                className="p-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
              e.target.value = '';
            }}
          />
        </div>
      )}

      {/* ── Members panel ────────────────────────────────────────────────── */}
      {showAddMember && activeGroup && (
        <div className="w-64 shrink-0 border-l border-gray-100 bg-gray-50 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-900">Members</p>
            <button onClick={() => setShowAddMember(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="p-3 space-y-1">
              {activeGroup.members.map((m) => (
                <div
                  key={m._id}
                  className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-gray-100"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold">
                      {m.name[0]}
                    </div>
                    <span className="text-xs text-gray-700 truncate max-w-[100px]">{m.name}</span>
                  </div>
                  {activeGroup.type === 'custom' && m._id !== currentUser?.id && (
                    <button
                      onClick={() => removeMemberMut.mutate(m._id)}
                      className="text-red-400 hover:text-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {activeGroup.type === 'custom' && (
            <div className="p-3 border-t border-gray-100">
              <p className="text-xs font-medium text-gray-600 mb-2">Add Member</p>
              <input
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
                placeholder="Search…"
                value={addMemberSearch}
                onChange={(e) => setAddMemberSearch(e.target.value)}
              />
              {addMemberSearch && (
                <div className="mt-1 max-h-28 overflow-y-auto border border-gray-200 rounded-lg bg-white">
                  {allUsers
                    .filter(
                      (u) =>
                        u.name.toLowerCase().includes(addMemberSearch.toLowerCase()) &&
                        !activeGroup.members.some((m) => m._id === u._id),
                    )
                    .slice(0, 8)
                    .map((u) => (
                      <button
                        key={u._id}
                        onClick={() => {
                          addMemberMut.mutate(u._id);
                          setAddMemberSearch('');
                        }}
                        className="w-full text-left px-2 py-1.5 text-xs hover:bg-gray-50"
                      >
                        {u.name}
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── New group modal ──────────────────────────────────────────────── */}
      {showNewGroup && (
        <NewGroupModal
          onClose={() => setShowNewGroup(false)}
          onCreated={(g) => {
            refetchGroups();
            setShowNewGroup(false);
            setActiveGroup(g);
            setActiveTab('custom');
          }}
        />
      )}
    </div>
  );
}
