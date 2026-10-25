import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '@ti/shared';

@Controller('departments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DepartmentsController {
  constructor(private service: DepartmentsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.DEPARTMENTS_READ)
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.DEPARTMENTS_READ)
  findOne(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.DEPARTMENTS_CREATE)
  create(@Body() dto: CreateDepartmentDto, @CurrentUser() actor: { _id: string }) {
    return this.service.create(dto, actor._id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.DEPARTMENTS_EDIT)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
    @CurrentUser() actor: { _id: string },
  ) {
    return this.service.update(id, dto, actor._id);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.DEPARTMENTS_DELETE)
  deactivate(@Param('id') id: string, @CurrentUser() actor: { _id: string }) {
    return this.service.deactivate(id, actor._id);
  }
}
