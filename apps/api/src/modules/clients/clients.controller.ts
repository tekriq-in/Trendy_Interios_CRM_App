import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, ParseBoolPipe, DefaultValuePipe } from '@nestjs/common';
import { ClientsService, CreateClientDto, UpdateClientDto } from './clients.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '@ti/shared';

@Controller('clients')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ClientsController {
  constructor(private service: ClientsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CLIENTS_READ)
  findAll(
    @Query('search') search?: string,
    @Query('includeInactive', new DefaultValuePipe(false), ParseBoolPipe) includeInactive?: boolean,
  ) {
    return this.service.findAll({ search, includeInactive });
  }

  @Patch(':id/deactivate')
  @RequirePermissions(PERMISSIONS.CLIENTS_EDIT)
  deactivate(@Param('id') id: string, @CurrentUser() actor: { _id: string }) {
    return this.service.deactivate(id, actor._id);
  }

  @Patch(':id/reactivate')
  @RequirePermissions(PERMISSIONS.CLIENTS_EDIT)
  reactivate(@Param('id') id: string, @CurrentUser() actor: { _id: string }) {
    return this.service.reactivate(id, actor._id);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.CLIENTS_READ)
  findOne(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CLIENTS_CREATE)
  create(@Body() dto: CreateClientDto, @CurrentUser() actor: { _id: string }) {
    return this.service.create(dto, actor._id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.CLIENTS_EDIT)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
    @CurrentUser() actor: { _id: string },
  ) {
    return this.service.update(id, dto, actor._id);
  }
}
