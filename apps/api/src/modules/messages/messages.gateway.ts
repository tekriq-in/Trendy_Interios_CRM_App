import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OnEvent } from '@nestjs/event-emitter';
import { Message, MessageDocument } from './messages.schema';
import { ChatGroupsService } from '../chat-groups/chat-groups.service';
import { NotificationsService } from '../notifications/notifications.service';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Role, RoleDocument } from '../roles/schemas/role.schema';
import { PERMISSIONS } from '@ti/shared';
import { escapeRegExp } from '../../common/utils/escape-regex';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/' })
export class MessagesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  constructor(
    private readonly jwtService: JwtService,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Role.name) private roleModel: Model<RoleDocument>,
    private readonly chatGroupsService: ChatGroupsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        (client.handshake.headers?.authorization as string)?.replace('Bearer ', '');
      const payload = this.jwtService.verify(token, { secret: process.env.JWT_SECRET });
      client.data.userId = payload.sub;
      client.data.email = payload.email;
      client.data.name = payload.name ?? payload.email;

      // Auto-join approver room so client.replied notifications reach MD/GM
      client.data.canReadAll = false;
      const user = await this.userModel.findById(payload.sub).select('role isActive mustChangePassword').lean();
      // A deactivated user, or one who must change their password first, may not use chat.
      if (!user?.isActive || user.mustChangePassword) {
        client.disconnect();
        return;
      }
      if (user.role) {
        const role = await this.roleModel.findById(user.role).select('permissions').lean();
        if (role?.permissions?.includes(PERMISSIONS.APPROVALS_DECIDE)) {
          client.join('role:approver');
        }
        // Read once per connection (tokens last 15 minutes, so clients reconnect regularly).
        client.data.canReadAll = role?.permissions?.includes(PERMISSIONS.PROJECTS_READ_ALL) ?? false;
      }
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(_client: Socket) {}

  /**
   * May this socket's user use chat at all? Re-checked on every event, so a user who is
   * deactivated or who must change their password is cut off immediately, not only at connect.
   */
  private async canUseChat(client: Socket): Promise<boolean> {
    const userId = client.data.userId;
    if (typeof userId !== 'string') {
      client.disconnect();
      return false;
    }

    const user = await this.userModel.findById(userId).select('isActive mustChangePassword').lean();
    if (!user?.isActive || user.mustChangePassword) {
      client.disconnect();
      return false;
    }
    return true;
  }

  /**
   * May this socket's user use THIS channel? Requires an active user (canUseChat), then
   * channel access: members, anyone for department chats, and read-all roles.
   */
  private async canAccess(client: Socket, channel: unknown): Promise<boolean> {
    if (typeof channel !== 'string' || !channel || !client.data.userId) return false;
    if (!(await this.canUseChat(client))) return false;
    return this.chatGroupsService.canAccessChannel(
      client.data.userId,
      client.data.canReadAll === true,
      channel,
    );
  }

  emitMessageUpdated(message: Record<string, unknown>) {
    if (this.server && typeof message.channel === 'string') {
      this.server.to(message.channel).emit('message_updated', message);
    }
  }

  emitMessageDeleted(channel: string, messageId: string) {
    if (this.server) this.server.to(channel).emit('message_deleted', { channel, messageId });
  }

  @SubscribeMessage('join_channel')
  async handleJoinChannel(@ConnectedSocket() client: Socket, @MessageBody() channel: string) {
    // Previously anyone could join any channel name and read its live messages.
    if (!(await this.canAccess(client, channel))) {
      return { event: 'error', data: 'messages.channel_access_denied' };
    }
    client.join(channel);
    return { event: 'joined', data: channel };
  }

  @SubscribeMessage('leave_channel')
  handleLeaveChannel(@ConnectedSocket() client: Socket, @MessageBody() channel: string) {
    client.leave(channel);
  }

  @SubscribeMessage('message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      channel: string;
      body: string;
      attachments?: string[];
      mediaType?: string;
      mediaUrl?: string;
    },
  ) {
    if (!client.data.userId) return;
    if (typeof payload?.body !== 'string' || !payload.body.trim()) return;
    if (!(await this.canAccess(client, payload.channel))) {
      return { event: 'error', data: 'messages.channel_access_denied' };
    }

    // Parse @mentions: match @Name patterns
    const mentionHandles = (payload.body.match(/@([\w\s]+?)(?=\s|$|@)/g) ?? [])
      .map((m) => m.slice(1).trim());

    let mentionedIds: string[] = [];
    if (mentionHandles.length > 0) {
      // The handle is user text: escape it (it was used as a raw pattern, so a crafted
      // @mention could hang the server or match everyone) and cap how many are looked up.
      const regex = mentionHandles.slice(0, 10).map((h) => new RegExp(escapeRegExp(h.slice(0, 60)), 'i'));
      const users = await this.userModel
        .find({ name: { $in: regex }, isActive: true })
        .select('_id fcmToken name')
        .lean();
      mentionedIds = users.map((u) => String(u._id));

      // Priority notifications for mentioned users
      const fcmTokens = users.map((u) => u.fcmToken).filter(Boolean) as string[];
      if (fcmTokens.length > 0) {
        await this.notificationsService.sendToMany(
          fcmTokens,
          `@${client.data.name} mentioned you`,
          payload.body.length > 80 ? payload.body.slice(0, 80) + '…' : payload.body,
          { type: 'mention', channel: payload.channel, senderId: client.data.userId },
        );
      }
    }

    const msg = await this.messageModel.create({
      channel: payload.channel,
      sender: client.data.userId,
      body: payload.body,
      attachments: payload.attachments ?? [],
      mentions: mentionedIds,
      mediaType: payload.mediaType ?? null,
      mediaUrl: payload.mediaUrl ?? null,
      createdBy: client.data.userId,
    });

    const populated = await msg.populate([
      { path: 'sender', select: 'name email' },
      { path: 'mentions', select: 'name email' },
    ]);

    this.server.to(payload.channel).emit('message', populated.toObject());
    return populated.toObject();
  }

  @SubscribeMessage('mark_read')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { channel: string; messageId: string },
  ) {
    if (!client.data.userId) return;
    if (!(await this.canAccess(client, payload?.channel))) return;
    await this.messageModel.updateMany(
      { channel: payload.channel, 'readBy.user': { $ne: client.data.userId } },
      { $push: { readBy: { user: client.data.userId, readAt: new Date() } } },
    );
  }

  emitToChannel(channel: string, event: string, data: unknown) {
    this.server.to(channel).emit(event, data);
  }

  @OnEvent('handover.status_changed')
  handleHandoverUpdate(payload: { projectId: string; handoverId: string; status: string }) {
    this.server.to(`project:${payload.projectId}`).emit('handover_update', payload);
  }

  @OnEvent('project.progress_updated')
  handleProgressUpdate(payload: { projectId: string; progressPct: number }) {
    this.server.to(`project:${payload.projectId}`).emit('project_progress', payload);
  }

  @OnEvent('chat_group.member_added')
  handleMemberAdded(payload: { channel: string; userId: string; groupName: string }) {
    this.server.to(payload.channel).emit('group_member_added', payload);
  }

  @OnEvent('chat_group.member_removed')
  handleMemberRemoved(payload: { channel: string; userId: string }) {
    this.server.to(payload.channel).emit('group_member_removed', payload);
  }

  @OnEvent('client.replied')
  handleClientReply(payload: {
    clientId: string;
    clientName: string;
    projectId: string | null;
    approvalId: string | null;
    body: string;
    isConfirmation: boolean;
    isRejection: boolean;
  }) {
    this.server.to('role:approver').emit('notification', {
      type: 'client_reply',
      message: `${payload.clientName} replied to a project update`,
      ...payload,
    });
  }
}
