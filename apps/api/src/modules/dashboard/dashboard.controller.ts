import { Controller, Get, UseGuards } from '@nestjs/common';
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
  getBoard() {
    return this.service.getBoard();
  }

  @Get('workload')
  getWorkload() {
    return this.service.getWorkload();
  }

  @Get('blockers')
  getBlockers() {
    return this.service.getBlockersSummary();
  }

  @Get('approvals-pending')
  getApprovalsPending() {
    return this.service.getApprovalsPending();
  }

  @Get('stage-durations')
  getStageDurations() {
    return this.service.getStageDurations();
  }
}
