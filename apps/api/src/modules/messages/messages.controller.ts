import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Message, MessageDocument } from './messages.schema';
import { ChatGroup, ChatGroupDocument } from '../chat-groups/chat-group.schema';
import { PERMISSIONS } from '@ti/shared';
import { MessagesGateway } from './messages.gateway';

@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessagesController {
  constructor(
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(ChatGroup.name) private groupModel: Model<ChatGroupDocument>,
    private readonly messagesGateway: MessagesGateway,
  ) {}

  @Get(':channel(*)')
  async history(
    @Param('channel') channel: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @CurrentUser() actor: { _id: string; rolePermissions: string[] },
  ) {
    const decodedChannel = decodeURIComponent(channel);

    const group = await this.groupModel
      .findOne({ channel: decodedChannel, isActive: true })
      .select('type members')
      .lean();

    if (group) {
      const isDeptChannel = group.type === 'department';
      const canReadAll = actor.rolePermissions?.includes(PERMISSIONS.PROJECTS_READ_ALL);
      const isMember = group.members.some(
        (m: Types.ObjectId) => String(m) === actor._id,
      );
      if (!isDeptChannel && !isMember && !canReadAll) {
        throw new ForbiddenException('messages.channel_access_denied');
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [data, total] = await Promise.all([
      this.messageModel
        .find({ channel: decodedChannel, isDeleted: { $ne: true } })
        .populate('sender', 'name email')
        .populate('mentions', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      this.messageModel.countDocuments({ channel: decodedChannel, isDeleted: { $ne: true } }),
    ]);
    return { data, total, page: parseInt(page), limit: parseInt(limit) };
  }

  @Patch(':id')
  async edit(
    @Param('id') id: string,
    @Body() dto: { body: string },
    @CurrentUser() actor: { _id: string; rolePermissions: string[] },
  ) {
    const body = typeof dto.body === 'string' ? dto.body.trim() : '';
    if (!body) throw new BadRequestException('messages.body_required');
    if (body.length > 4000) throw new BadRequestException('messages.body_too_long');

    const message = await this.findOwnMessage(id, actor);
    if (message.isDeleted) throw new BadRequestException('messages.already_deleted');
    message.body = body;
    message.editedAt = new Date();
    await message.save();

    const populated = await message.populate([
      { path: 'sender', select: 'name email' },
      { path: 'mentions', select: 'name email' },
    ]);
    const result = populated.toObject();
    this.messagesGateway.emitMessageUpdated(result);
    return result;
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @CurrentUser() actor: { _id: string; rolePermissions: string[] },
  ) {
    const message = await this.findOwnMessage(id, actor);
    if (message.isDeleted) return { success: true };

    message.isDeleted = true;
    message.deletedAt = new Date();
    // Keep the required body field valid while the UI hides deleted messages.
    message.body = 'Message deleted';
    message.attachments = [];
    message.mediaType = null;
    message.mediaUrl = null;
    await message.save();

    this.messagesGateway.emitMessageDeleted(message.channel, String(message._id));
    return { success: true };
  }

  private async findOwnMessage(
    id: string,
    actor: { _id: string; rolePermissions: string[] },
  ): Promise<MessageDocument> {
    const message = await this.messageModel.findById(id);
    if (!message) throw new NotFoundException('messages.not_found');
    if (String(message.sender) !== actor._id) {
      throw new ForbiddenException('messages.can_only_change_own');
    }

    const group = await this.groupModel
      .findOne({ channel: message.channel, isActive: true })
      .select('type members')
      .lean();
    if (!group) throw new NotFoundException('messages.channel_not_found');

    const isMember = group.members.some((member: Types.ObjectId) => String(member) === actor._id);
    const canReadAll = actor.rolePermissions?.includes(PERMISSIONS.PROJECTS_READ_ALL);
    if (group.type !== 'department' && !isMember && !canReadAll) {
      throw new ForbiddenException('messages.channel_access_denied');
    }
    return message;
  }
}
