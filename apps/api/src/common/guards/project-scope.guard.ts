import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Project, ProjectDocument } from '../../modules/projects/schemas/project.schema';
import { PERMISSIONS } from '@ti/shared';

@Injectable()
export class ProjectScopeGuard implements CanActivate {
  constructor(
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      user: { _id: string; rolePermissions: string[] };
      params: { id?: string; projectId?: string };
    }>();

    const { user, params } = request;
    if (!user) throw new ForbiddenException('auth.required');

    // MD/GM with read_all bypass scope check
    if (user.rolePermissions?.includes(PERMISSIONS.PROJECTS_READ_ALL)) {
      return true;
    }

    const projectId = params.id || params.projectId;
    if (!projectId) return true;

    if (!Types.ObjectId.isValid(projectId)) {
      throw new ForbiddenException('project.not_found');
    }

    const project = await this.projectModel.findOne({
      _id: new Types.ObjectId(projectId),
      assignedTeam: new Types.ObjectId(user._id),
    });

    if (!project) throw new ForbiddenException('project.access_denied');

    return true;
  }
}
