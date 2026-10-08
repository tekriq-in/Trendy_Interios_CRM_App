import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Message, MessageDocument } from './messages.schema';

@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessagesController {
  constructor(@InjectModel(Message.name) private messageModel: Model<MessageDocument>) {}

  @Get(':channel')
  async history(
    @Param('channel') channel: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [data, total] = await Promise.all([
      this.messageModel
        .find({ channel })
        .populate('sender', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      this.messageModel.countDocuments({ channel }),
    ]);
    return { data, total, page: parseInt(page), limit: parseInt(limit) };
  }
}
