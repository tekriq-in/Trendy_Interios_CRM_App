import { Controller, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { HandoversService } from './handovers.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('handovers')
@UseGuards(JwtAuthGuard)
export class HandoversController {
  constructor(private service: HandoversService) {}

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
    @CurrentUser() actor: { _id: string; rolePermissions: string[] },
  ) {
    return this.service.raise(dto, actor);
  }

  @Patch(':id/confirm')
  confirm(
    @Param('id') id: string,
    @CurrentUser() actor: { _id: string; rolePermissions: string[] },
  ) {
    return this.service.confirm(id, actor);
  }

  @Patch(':id/accept')
  accept(
    @Param('id') id: string,
    @CurrentUser() actor: { _id: string; rolePermissions: string[] },
  ) {
    return this.service.accept(id, actor);
  }

  @Patch(':id/reject')
  reject(
    @Param('id') id: string,
    @Body() dto: { reason: string },
    @CurrentUser() actor: { _id: string; rolePermissions: string[] },
  ) {
    return this.service.reject(id, dto.reason, actor);
  }
}
