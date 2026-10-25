import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UsersService, CreateUserDto, UpdateUserDto } from './users.service';
import { PERMISSIONS } from '@ti/shared';

@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  // Lightweight endpoint — any logged-in user can fetch colleagues for chat
  @Get('for-chat')
  findForChat() {
    return this.usersService.findAll({ isActive: true }).then((users) =>
      users.map((u) => ({ _id: u._id, name: u.name, email: u.email })),
    );
  }

  @Get()
  @RequirePermissions(PERMISSIONS.USERS_READ)
  findAll(@Query('departmentId') departmentId?: string, @Query('isActive') isActive?: string) {
    return this.usersService.findAll({
      departmentId,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });
  }

  @Get('org-chart')
  @RequirePermissions(PERMISSIONS.USERS_READ)
  getOrgChart() {
    return this.usersService.getOrgChart();
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.USERS_READ)
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.USERS_CREATE)
  create(@Body() dto: CreateUserDto, @CurrentUser() actor: { _id: string }) {
    return this.usersService.create(dto, actor._id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.USERS_EDIT)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: { _id: string },
  ) {
    return this.usersService.update(id, dto, actor._id);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.USERS_DELETE)
  @HttpCode(HttpStatus.OK)
  deactivate(@Param('id') id: string, @CurrentUser() actor: { _id: string }) {
    return this.usersService.deactivate(id, actor._id);
  }
}
