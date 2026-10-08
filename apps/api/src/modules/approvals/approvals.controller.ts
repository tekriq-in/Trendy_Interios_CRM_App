import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { ApprovalsService } from './approvals.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '@ti/shared';

@Controller('approvals')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ApprovalsController {
  constructor(private service: ApprovalsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.APPROVALS_DECIDE)
  findPending() {
    return this.service.findPending();
  }

  @Post()
  @RequirePermissions(PERMISSIONS.APPROVALS_REQUEST)
  request(
    @Body() dto: { projectId: string; kind: string; linkedDocumentId?: string },
    @CurrentUser() actor: { _id: string; rolePermissions: string[] },
  ) {
    return this.service.request(dto, actor);
  }

  @Patch(':id/approve')
  @RequirePermissions(PERMISSIONS.APPROVALS_DECIDE)
  approve(
    @Param('id') id: string,
    @CurrentUser() actor: { _id: string; rolePermissions: string[] },
  ) {
    return this.service.approve(id, actor);
  }

  @Patch(':id/reject')
  @RequirePermissions(PERMISSIONS.APPROVALS_DECIDE)
  reject(
    @Param('id') id: string,
    @Body() dto: { reason: string },
    @CurrentUser() actor: { _id: string; rolePermissions: string[] },
  ) {
    return this.service.reject(id, dto.reason, actor);
  }
}
