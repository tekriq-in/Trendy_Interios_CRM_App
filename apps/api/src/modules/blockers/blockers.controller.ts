import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { BlockersService } from './blockers.service';
import { RaiseBlockerDto } from './dto/blocker.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('blockers')
@UseGuards(JwtAuthGuard)
export class BlockersController {
  constructor(private service: BlockersService) {}

  @Get()
  findAll(
    @CurrentUser() user: { _id: string; rolePermissions: string[] },
    @Query('status') status?: string,
  ) {
    return this.service.findAll(user, status);
  }

  @Post()
  raise(
    @Body() dto: RaiseBlockerDto,
    @CurrentUser() actor: { _id: string; rolePermissions: string[] },
  ) {
    return this.service.raise(dto, actor);
  }

  @Patch(':id/trigger-sla')
  triggerSla(
    @Param('id') id: string,
    @CurrentUser() actor: { _id: string; rolePermissions: string[] },
  ) {
    return this.service.triggerSla(id, actor);
  }

  @Patch(':id/resolve')
  resolve(
    @Param('id') id: string,
    @CurrentUser() actor: { _id: string; rolePermissions: string[] },
  ) {
    return this.service.resolve(id, actor);
  }
}
