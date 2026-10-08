import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { RolesService } from './roles.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '@ti/shared';

@Controller('roles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RolesController {
  constructor(private rolesService: RolesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ROLES_READ)
  findAll() {
    return this.rolesService.findAll();
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.ROLES_READ)
  findOne(@Param('id') id: string) {
    return this.rolesService.findById(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ROLES_CREATE)
  create(
    @Body() dto: { name: string; permissions: string[] },
    @CurrentUser() actor: { _id: string },
  ) {
    return this.rolesService.create(dto, actor._id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.ROLES_EDIT)
  update(
    @Param('id') id: string,
    @Body() dto: { name?: string; permissions?: string[] },
    @CurrentUser() actor: { _id: string },
  ) {
    return this.rolesService.update(id, dto, actor._id);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.ROLES_DELETE)
  remove(@Param('id') id: string, @CurrentUser() actor: { _id: string }) {
    return this.rolesService.remove(id, actor._id);
  }
}
