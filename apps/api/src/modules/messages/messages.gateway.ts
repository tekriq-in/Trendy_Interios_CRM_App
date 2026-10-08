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

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/' })
export class MessagesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  constructor(
    private readonly jwtService: JwtService,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        (client.handshake.headers?.authorization as string)?.replace('Bearer ', '');
      const payload = this.jwtService.verify(token, { secret: process.env.JWT_SECRET });
      client.data.userId = payload.sub;
      client.data.email = payload.email;
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
    @MessageBody() payload: { channel: string; body: string; attachments?: string[] },
  ) {
    if (!client.data.userId) return;
    const msg = await this.messageModel.create({
      channel: payload.channel,
      sender: client.data.userId,
      body: payload.body,
      attachments: payload.attachments || [],
      createdBy: client.data.userId,
    });
    const populated = await msg.populate('sender', 'name email');
    this.server.to(payload.channel).emit('message', populated.toObject());
    return populated.toObject();
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
}
