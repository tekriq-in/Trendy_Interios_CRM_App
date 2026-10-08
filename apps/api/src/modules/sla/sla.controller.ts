import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { SlaService } from './sla.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('sla')
@UseGuards(JwtAuthGuard)
export class SlaController {
  constructor(private service: SlaService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('report')
  getReport() {
    return this.service.getReport();
  }

  @Patch(':departmentId')
  update(
    @Param('departmentId') departmentId: string,
    @Body() dto: { defaultHours: number },
    @CurrentUser() actor: { _id: string; rolePermissions: string[] },
  ) {
    return this.service.update(departmentId, dto.defaultHours, actor);
  }
}
