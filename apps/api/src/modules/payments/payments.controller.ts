import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '@ti/shared';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PaymentsController {
  constructor(private service: PaymentsService) {}

  @Get('projects/:projectId/payments')
  @RequirePermissions(PERMISSIONS.PROJECTS_READ_OWN)
  findByProject(@Param('projectId') projectId: string) {
    return this.service.findByProject(projectId);
  }

  @Get('payments/overdue')
  @RequirePermissions(PERMISSIONS.PAYMENTS_VIEW_ALL)
  findOverdue() {
    return this.service.findOverdue();
  }

  @Post('projects/:projectId/payments')
  @RequirePermissions(PERMISSIONS.PAYMENTS_RECORD)
  record(
    @Param('projectId') projectId: string,
    @Body() dto: { kind: string; amount: number; paidAt?: Date; notes?: string },
    @CurrentUser() actor: { _id: string },
  ) {
    return this.service.record(projectId, dto, actor._id);
  }
}
