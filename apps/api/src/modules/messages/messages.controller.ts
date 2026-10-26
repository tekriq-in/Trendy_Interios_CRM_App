import { Controller, Get, Param, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Message, MessageDocument } from './messages.schema';
import { ChatGroup, ChatGroupDocument } from '../chat-groups/chat-group.schema';
import { PERMISSIONS } from '@ti/shared';

@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessagesController {
  constructor(
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(ChatGroup.name) private groupModel: Model<ChatGroupDocument>,
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
        .find({ channel: decodedChannel })
        .populate('sender', 'name email')
        .populate('mentions', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      this.messageModel.countDocuments({ channel: decodedChannel }),
    ]);
    return { data, total, page: parseInt(page), limit: parseInt(limit) };
  }
}
