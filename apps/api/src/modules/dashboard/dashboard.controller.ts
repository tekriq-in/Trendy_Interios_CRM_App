import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '@ti/shared';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(PERMISSIONS.DASHBOARD_VIEW)
export class DashboardController {
  constructor(private service: DashboardService) {}

  @Get('board')
  getBoard(
    @CurrentUser() actor: { _id: string; rolePermissions: string[] },
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.getBoard({ from, to }, actor);
  }

  @Get('workload')
  getWorkload(
    @CurrentUser() actor: { _id: string; rolePermissions: string[] },
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.getWorkload({ from, to }, actor);
  }

  @Get('blockers')
  getBlockers(
    @CurrentUser() actor: { _id: string; rolePermissions: string[] },
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.getBlockersSummary({ from, to }, actor);
  }

  @Get('approvals-pending')
  getApprovalsPending(
    @CurrentUser() actor: { _id: string; rolePermissions: string[] },
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.getApprovalsPending({ from, to }, actor);
  }

  @Get('stage-durations')
  getStageDurations(
    @CurrentUser() actor: { _id: string; rolePermissions: string[] },
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.getStageDurations({ from, to }, actor);
  }
}
