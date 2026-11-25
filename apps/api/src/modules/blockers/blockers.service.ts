import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Blocker, BlockerDocument } from './schemas/blocker.schema';
import { Project, ProjectDocument } from '../projects/schemas/project.schema';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { PERMISSIONS } from '@ti/shared';
import { ProjectAccessService } from '../../common/access/project-access.service';

@Injectable()
export class BlockersService {
  constructor(
    @InjectModel(Blocker.name) private blockerModel: Model<BlockerDocument>,
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    private activityLog: ActivityLogService,
    private eventEmitter: EventEmitter2,
    private access: ProjectAccessService,
  ) {}

  async findAll(user: { _id: string; rolePermissions: string[] }, status?: string) {
    const hasReadAll = user.rolePermissions.includes(PERMISSIONS.PROJECTS_READ_ALL);
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;

    if (!hasReadAll) {
      const projects = await this.projectModel
        .find({ assignedTeam: new Types.ObjectId(user._id) })
        .select('_id')
        .lean();
      const projectIds = projects.map((project) => project._id);
      if (projectIds.length === 0) return [];
      filter.project = { $in: projectIds };
    }

    return this.blockerModel
      .find(filter)
      .populate('project', 'title')
      .populate('raisedBy', 'name')
      .sort({ createdAt: -1 })
      .lean();
  }

  async raise(
    dto: { projectId: string; title: string; description?: string; type: string },
    actor: { _id: string; rolePermissions: string[] },
  ) {
    if (!actor.rolePermissions.includes(PERMISSIONS.BLOCKERS_RAISE)) {
      throw new ForbiddenException('auth.insufficient_permissions');
    }
    await this.access.assertAccess(dto.projectId, actor);

    const blocker = await this.blockerModel.create({
      project: new Types.ObjectId(dto.projectId),
      raisedBy: new Types.ObjectId(actor._id),
      title: dto.title,
      description: dto.description,
      type: dto.type,
      createdBy: new Types.ObjectId(actor._id),
    });

    await this.activityLog.record({
      actor: actor._id,
      action: 'blocker.raised',
      entity: 'blockers',
      entityId: String(blocker._id),
      metadata: { type: dto.type },
    });

    this.eventEmitter.emit('blocker.raised', {
      blockerId: String(blocker._id),
      projectId: dto.projectId,
      title: dto.title,
      type: dto.type,
      raisedBy: actor._id,
    });

    return blocker;
  }

  async triggerSla(id: string, actor: { _id: string; rolePermissions: string[] }) {
    if (!actor.rolePermissions.includes(PERMISSIONS.BLOCKERS_TRIGGER_SLA)) {
      throw new ForbiddenException('auth.insufficient_permissions');
    }
    await this.assertBlockerAccess(id, actor);

    const blocker = await this.blockerModel.findByIdAndUpdate(
      id,
      {
        status: 'sla_triggered',
        slaTriggeredAt: new Date(),
        slaTriggeredBy: new Types.ObjectId(actor._id),
      },
      { new: true },
    );
    if (!blocker) throw new NotFoundException('blocker.not_found');

    await this.activityLog.record({
      actor: actor._id,
      action: 'blocker.sla_triggered',
      entity: 'blockers',
      entityId: id,
    });

    return blocker;
  }

  async resolve(id: string, actor: { _id: string; rolePermissions: string[] }) {
    if (!actor.rolePermissions.includes(PERMISSIONS.BLOCKERS_RESOLVE)) {
      throw new ForbiddenException('auth.insufficient_permissions');
    }
    await this.assertBlockerAccess(id, actor);

    const blocker = await this.blockerModel.findByIdAndUpdate(
      id,
      { status: 'resolved', resolvedAt: new Date(), resolvedBy: new Types.ObjectId(actor._id) },
      { new: true },
    );
    if (!blocker) throw new NotFoundException('blocker.not_found');

    await this.activityLog.record({
      actor: actor._id,
      action: 'blocker.resolved',
      entity: 'blockers',
      entityId: id,
    });

    return blocker;
  }

  /** The blocker must exist and belong to a project the actor can see (404 otherwise). */
  private async assertBlockerAccess(id: string, actor: { _id: string; rolePermissions: string[] }) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('blocker.not_found');
    const existing = await this.blockerModel.findById(id).select('project').lean();
    if (!existing) throw new NotFoundException('blocker.not_found');
    await this.access.assertAccess(String(existing.project), actor);
  }
}
