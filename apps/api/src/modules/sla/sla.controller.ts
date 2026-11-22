import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { SlaService } from './sla.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '@ti/shared';

@Controller('sla')
@UseGuards(JwtAuthGuard)
export class SlaController {
  constructor(private service: SlaService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('report')
  getReport(@CurrentUser() actor: { _id: string; rolePermissions: string[] }) {
    return this.service.getReport(actor);
  }

  @Patch(':departmentId')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(PERMISSIONS.SLA_EDIT)
  update(
    @Param('departmentId') departmentId: string,
    @Body() dto: { defaultHours: number },
    @CurrentUser() actor: { _id: string; rolePermissions: string[] },
  ) {
    return this.service.update(departmentId, dto.defaultHours, actor);
  }
}
