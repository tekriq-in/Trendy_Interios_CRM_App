import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { ProjectsService, CreateProjectDto, UpdateProjectDto } from './projects.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '@ti/shared';

@Controller('projects')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProjectsController {
  constructor(private service: ProjectsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.PROJECTS_READ_OWN)
  findAll(@CurrentUser() user: { _id: string; rolePermissions: string[] }) {
    return this.service.findAll(user);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.PROJECTS_READ_OWN)
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: { _id: string; rolePermissions: string[] },
  ) {
    return this.service.findById(id, user);
  }

  @Get(':id/progress')
  @RequirePermissions(PERMISSIONS.PROJECTS_READ_OWN)
  getProgress(@Param('id') id: string) {
    return this.service.getProgress(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.PROJECTS_CREATE)
  create(@Body() dto: CreateProjectDto, @CurrentUser() actor: { _id: string }) {
    return this.service.create(dto, actor._id);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.PROJECTS_EDIT)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() actor: { _id: string; rolePermissions: string[] },
  ) {
    return this.service.update(id, dto, actor._id, actor.rolePermissions);
  }

  @Post(':id/advance-stage')
  @RequirePermissions(PERMISSIONS.PROJECTS_ADVANCE_STAGE)
  advanceStage(
    @Param('id') id: string,
    @Body() dto: { nextStageId: string },
    @CurrentUser() actor: { _id: string; rolePermissions: string[] },
  ) {
    return this.service.advanceStage(id, dto.nextStageId, actor._id, actor.rolePermissions);
  }

  @Post(':id/additional-work')
  @RequirePermissions(PERMISSIONS.PROJECTS_EDIT)
  addAdditionalWork(
    @Param('id') id: string,
    @Body() dto: { description: string; amount: number; drawingRequired?: boolean },
    @CurrentUser() actor: { _id: string },
  ) {
    return this.service.addAdditionalWork(id, dto, actor._id);
  }
}
