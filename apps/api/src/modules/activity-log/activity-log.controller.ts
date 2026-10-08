import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ActivityLogService } from './activity-log.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '@ti/shared';

@Controller('activity-log')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(PERMISSIONS.ACTIVITY_LOG_READ)
export class ActivityLogController {
  constructor(private service: ActivityLogService) {}

  @Get()
  findAll(
    @CurrentUser() user: { rolePermissions: string[] },
    @Query('actorId') actorId?: string,
    @Query('entity') entity?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    return this.service.findAll(
      { actorId, entity, from, to },
      Number(page),
      Number(limit),
      user.rolePermissions,
    );
  }
}
