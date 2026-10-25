import { api } from './api';
import type { ChatGroup, ChatMessage, PaginatedResponse } from '@ti/shared';

export async function fetchGroups(): Promise<ChatGroup[]> {
  const res = await api.get<ChatGroup[]>('/chat-groups');
  return res.data;
}

export async function fetchGroupById(groupId: string): Promise<ChatGroup> {
  const res = await api.get<ChatGroup>(`/chat-groups/${groupId}`);
  return res.data;
}

export async function createGroup(dto: { name: string; memberIds: string[] }): Promise<ChatGroup> {
  const res = await api.post<ChatGroup>('/chat-groups', dto);
  return res.data;
}

export async function openDM(targetUserId: string): Promise<ChatGroup> {
  const res = await api.post<ChatGroup>(`/chat-groups/dm/${targetUserId}`);
  return res.data;
}

export async function fetchHistory(
  channel: string,
  page = 1,
  limit = 50,
): Promise<PaginatedResponse<ChatMessage>> {
  const res = await api.get<PaginatedResponse<ChatMessage>>(
    `/messages/${encodeURIComponent(channel)}`,
    { params: { page, limit } },
  );
  return res.data;
}

export async function addMember(groupId: string, userId: string): Promise<ChatGroup> {
  const res = await api.post<ChatGroup>(`/chat-groups/${groupId}/members`, { userId });
  return res.data;
}

export async function removeMember(groupId: string, userId: string): Promise<void> {
  await api.delete(`/chat-groups/${groupId}/members/${userId}`);
}

export async function fetchUsers(): Promise<{ _id: string; name: string; email: string }[]> {
  const res = await api.get<{ _id: string; name: string; email: string }[]>('/users/for-chat');
  return res.data;
}
