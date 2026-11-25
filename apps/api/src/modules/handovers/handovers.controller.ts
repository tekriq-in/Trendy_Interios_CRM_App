import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { HandoversService, type HandoverActor } from './handovers.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('handovers')
@UseGuards(JwtAuthGuard)
export class HandoversController {
  constructor(private service: HandoversService) {}

  @Get()
  findAll(
    @CurrentUser() actor: HandoverActor,
    @Query('projectId') projectId?: string,
  ) {
    return this.service.findAll(actor, projectId);
  }

  @Post()
  raise(
    @Body()
    dto: {
      projectId: string;
      fromDepartmentId: string;
      toDepartmentId: string;
      proofFileIds: string[];
      notes?: string;
    },
    @CurrentUser() actor: HandoverActor,
  ) {
    return this.service.raise(dto, actor);
  }

  @Patch(':id/confirm')
  confirm(
    @Param('id') id: string,
    @CurrentUser() actor: HandoverActor,
  ) {
    return this.service.confirm(id, actor);
  }

  @Patch(':id/accept')
  accept(
    @Param('id') id: string,
    @CurrentUser() actor: HandoverActor,
  ) {
    return this.service.accept(id, actor);
  }

  @Patch(':id/reject')
  reject(
    @Param('id') id: string,
    @Body() dto: { reason: string },
    @CurrentUser() actor: HandoverActor,
  ) {
    return this.service.reject(id, dto.reason, actor);
  }
}
