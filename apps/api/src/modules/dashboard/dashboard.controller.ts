import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '@ti/shared';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(PERMISSIONS.DASHBOARD_VIEW)
export class DashboardController {
  constructor(private service: DashboardService) {}

  @Get('board')
  getBoard(@Query('from') from?: string, @Query('to') to?: string) {
    return this.service.getBoard({ from, to });
  }

  @Get('workload')
  getWorkload(@Query('from') from?: string, @Query('to') to?: string) {
    return this.service.getWorkload({ from, to });
  }

  @Get('blockers')
  getBlockers(@Query('from') from?: string, @Query('to') to?: string) {
    return this.service.getBlockersSummary({ from, to });
  }

  @Get('approvals-pending')
  getApprovalsPending(@Query('from') from?: string, @Query('to') to?: string) {
    return this.service.getApprovalsPending({ from, to });
  }

  @Get('stage-durations')
  getStageDurations(@Query('from') from?: string, @Query('to') to?: string) {
    return this.service.getStageDurations({ from, to });
  }
}
