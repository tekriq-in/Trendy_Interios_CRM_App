import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PERMISSIONS } from '@ti/shared';
import { Project, ProjectDocument } from '../../modules/projects/schemas/project.schema';

export interface Actor {
  _id: string;
  rolePermissions: string[];
}

/**
 * One answer to "may this user see this project?", shared by every module that
 * acts on something that belongs to a project (tasks, handovers, blockers).
 *
 * SOW rule: employees only see and act on projects they are assigned to; roles
 * with `projects:read_all` (MD, GM) see everything. Enforcing it in one place
 * means a new endpoint cannot forget it the way the older ones did.
 */
@Injectable()
export class ProjectAccessService {
  constructor(@InjectModel(Project.name) private readonly projectModel: Model<ProjectDocument>) {}

  hasReadAll(actor: Actor): boolean {
    return actor.rolePermissions.includes(PERMISSIONS.PROJECTS_READ_ALL);
  }

  /**
   * Throws unless the actor can see the project. Answers 404, not 403, so a user
   * cannot tell "this project exists but is not yours" from "no such project".
   */
  async assertAccess(projectId: string, actor: Actor): Promise<void> {
    if (!Types.ObjectId.isValid(projectId)) throw new NotFoundException('project.not_found');
    const filter: Record<string, unknown> = { _id: new Types.ObjectId(projectId) };
    if (!this.hasReadAll(actor)) filter.assignedTeam = new Types.ObjectId(actor._id);
    const exists = await this.projectModel.exists(filter);
    if (!exists) throw new NotFoundException('project.not_found');
  }

  /**
   * The ids of the projects the actor may see, or `null` meaning "all of them"
   * (so callers can skip the filter for MD/GM).
   */
  async visibleProjectIds(actor: Actor): Promise<Types.ObjectId[] | null> {
    if (this.hasReadAll(actor)) return null;
    const projects = await this.projectModel
      .find({ assignedTeam: new Types.ObjectId(actor._id) })
      .select('_id')
      .lean();
    return projects.map((p) => p._id as Types.ObjectId);
  }
}
