import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Blocker, BlockerDocument } from './schemas/blocker.schema';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { PERMISSIONS } from '@ti/shared';

@Injectable()
export class BlockersService {
  constructor(
    @InjectModel(Blocker.name) private blockerModel: Model<BlockerDocument>,
    private activityLog: ActivityLogService,
    private eventEmitter: EventEmitter2,
  ) {}

  findAll(user: { _id: string; rolePermissions: string[] }, status?: string) {
    const hasReadAll = user.rolePermissions.includes(PERMISSIONS.PROJECTS_READ_ALL);
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;

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
}
