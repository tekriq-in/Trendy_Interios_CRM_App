import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '@ti/shared';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TasksController {
  constructor(private service: TasksService) {}

  @Get('projects/:projectId/tasks')
  @RequirePermissions(PERMISSIONS.PROJECTS_READ_OWN)
  findByProject(
    @Param('projectId') projectId: string,
    @CurrentUser() user: { _id: string; rolePermissions: string[] },
  ) {
    return this.service.findByProject(projectId, user);
  }

  @Post('projects/:projectId/tasks')
  @RequirePermissions(PERMISSIONS.TASKS_CREATE)
  create(
    @Param('projectId') projectId: string,
    @Body()
    dto: {
      title: string;
      description?: string;
      departmentId: string;
      assignedToId: string;
      dueDate?: Date;
      offlineCreatedAt?: Date;
    },
    @CurrentUser() actor: { _id: string; rolePermissions: string[] },
  ) {
    return this.service.create(projectId, dto, actor);
  }

  @Patch('tasks/:id')
  @RequirePermissions(PERMISSIONS.TASKS_EDIT)
  update(
    @Param('id') id: string,
    @Body() dto: { status?: string; assignedToId?: string; dueDate?: Date; photoId?: string },
    @CurrentUser() actor: { _id: string; rolePermissions: string[] },
  ) {
    return this.service.update(id, dto, actor);
  }

  @Delete('tasks/:id')
  @RequirePermissions(PERMISSIONS.TASKS_DELETE)
  remove(
    @Param('id') id: string,
    @CurrentUser() actor: { _id: string; rolePermissions: string[] },
  ) {
    return this.service.remove(id, actor);
  }
}
