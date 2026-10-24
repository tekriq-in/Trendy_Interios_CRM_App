import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ChatGroupsService, CreateGroupDto } from './chat-groups.service';

@UseGuards(JwtAuthGuard)
@Controller('chat-groups')
export class ChatGroupsController {
  constructor(private readonly service: ChatGroupsService) {}

  @Get()
  findMine(@Request() req: { user: { _id: string } }) {
    return this.service.findForUser(req.user._id);
  }

  @Post()
  create(
    @Body() dto: CreateGroupDto,
    @Request() req: { user: { _id: string } },
  ) {
    return this.service.create(dto, req.user._id);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
  ) {
    const group = await this.service.findById(id);
    if (!group) throw new NotFoundException('chat_group.not_found');
    return group;
  }

  @Post('dm/:targetUserId')
  openDM(
    @Param('targetUserId') targetUserId: string,
    @Request() req: { user: { _id: string } },
  ) {
    return this.service.findOrCreateDM(req.user._id, targetUserId);
  }

  @Post(':id/members')
  addMember(
    @Param('id') id: string,
    @Body('userId') userId: string,
    @Request() req: { user: { _id: string } },
  ) {
    return this.service.addMember(id, userId, req.user._id);
  }

  @Delete(':id/members/:userId')
  removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Request() req: { user: { _id: string } },
  ) {
    return this.service.removeMember(id, userId, req.user._id);
  }
}
