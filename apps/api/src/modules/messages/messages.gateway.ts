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
      const user = await this.userModel.findById(payload.sub).select('role').lean();
      if (user?.role) {
        const role = await this.roleModel.findById(user.role).select('permissions').lean();
        if (role?.permissions?.includes(PERMISSIONS.APPROVALS_DECIDE)) {
          client.join('role:approver');
        }
      }
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(_client: Socket) {}

  @SubscribeMessage('join_channel')
  handleJoinChannel(@ConnectedSocket() client: Socket, @MessageBody() channel: string) {
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

    // Parse @mentions: match @Name patterns
    const mentionHandles = (payload.body.match(/@([\w\s]+?)(?=\s|$|@)/g) ?? [])
      .map((m) => m.slice(1).trim());

    let mentionedIds: string[] = [];
    if (mentionHandles.length > 0) {
      const regex = mentionHandles.map((h) => new RegExp(h, 'i'));
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
