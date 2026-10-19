import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Handover, HandoverDocument } from './schemas/handover.schema';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { PERMISSIONS } from '@ti/shared';

@Injectable()
export class HandoversService {
  constructor(
    @InjectModel(Handover.name) private handoverModel: Model<HandoverDocument>,
    private activityLog: ActivityLogService,
    private eventEmitter: EventEmitter2,
  ) {}

  async findAll(projectId?: string) {
    const filter: Record<string, unknown> = {};
    if (projectId) filter.project = new Types.ObjectId(projectId);
    return this.handoverModel
      .find(filter)
      .populate('project', 'title')
      .populate('fromDepartment', 'name')
      .populate('toDepartment', 'name')
      .populate('raisedBy', 'name email')
      .populate('confirmedBy', 'name')
      .populate('acceptedBy', 'name')
      .populate('proofFiles', 'fileName driveLink mimeType type')
      .sort({ createdAt: -1 })
      .lean();
  }

  async raise(
    dto: {
      projectId: string;
      fromDepartmentId: string;
      toDepartmentId: string;
      proofFileIds: string[];
      notes?: string;
    },
    actor: { _id: string; rolePermissions: string[] },
  ) {
    if (!actor.rolePermissions.includes(PERMISSIONS.HANDOVERS_RAISE)) {
      throw new ForbiddenException('auth.insufficient_permissions');
    }

    if (!dto.proofFileIds || dto.proofFileIds.length === 0) {
      throw new BadRequestException('handover.proof_required');
    }

    const handover = await this.handoverModel.create({
      project: new Types.ObjectId(dto.projectId),
      fromDepartment: new Types.ObjectId(dto.fromDepartmentId),
      toDepartment: new Types.ObjectId(dto.toDepartmentId),
      raisedBy: new Types.ObjectId(actor._id),
      proofFiles: dto.proofFileIds.map((id) => new Types.ObjectId(id)),
      notes: dto.notes,
      status: 'draft',
      createdBy: new Types.ObjectId(actor._id),
    });

    await this.activityLog.record({
      actor: actor._id,
      action: 'handover.raised',
      entity: 'handovers',
      entityId: String(handover._id),
    });

    return handover;
  }

  async confirm(id: string, actor: { _id: string; rolePermissions: string[] }) {
    if (!actor.rolePermissions.includes(PERMISSIONS.HANDOVERS_CONFIRM_FROM)) {
      throw new ForbiddenException('auth.insufficient_permissions');
    }

    const handover = await this.handoverModel.findById(id);
    if (!handover) throw new NotFoundException('handover.not_found');
    if (handover.status !== 'draft') {
      throw new BadRequestException('handover.invalid_transition');
    }

    handover.status = 'confirmed';
    handover.confirmedBy = new Types.ObjectId(actor._id);
    await handover.save();

    await this.activityLog.record({
      actor: actor._id,
      action: 'handover.confirmed',
      entity: 'handovers',
      entityId: id,
    });

    this.eventEmitter.emit('handover.status_changed', {
      projectId: String(handover.project),
      handoverId: id,
      status: 'confirmed',
    });

    return handover;
  }

  async accept(id: string, actor: { _id: string; rolePermissions: string[] }) {
    if (!actor.rolePermissions.includes(PERMISSIONS.HANDOVERS_ACCEPT_TO)) {
      throw new ForbiddenException('auth.insufficient_permissions');
    }

    const handover = await this.handoverModel.findById(id);
    if (!handover) throw new NotFoundException('handover.not_found');
    if (handover.status !== 'confirmed') {
      throw new BadRequestException('handover.invalid_transition');
    }

    handover.status = 'accepted';
    handover.acceptedBy = new Types.ObjectId(actor._id);
    await handover.save();

    await this.activityLog.record({
      actor: actor._id,
      action: 'handover.accepted',
      entity: 'handovers',
      entityId: id,
    });

    this.eventEmitter.emit('handover.status_changed', {
      projectId: String(handover.project),
      handoverId: id,
      status: 'accepted',
    });

    return handover;
  }

  async reject(id: string, reason: string, actor: { _id: string; rolePermissions: string[] }) {
    if (!actor.rolePermissions.includes(PERMISSIONS.HANDOVERS_ACCEPT_TO)) {
      throw new ForbiddenException('auth.insufficient_permissions');
    }

    if (!reason?.trim()) throw new BadRequestException('handover.reason_required');

    const handover = await this.handoverModel.findById(id);
    if (!handover) throw new NotFoundException('handover.not_found');
    if (handover.status !== 'confirmed') {
      throw new BadRequestException('handover.invalid_transition');
    }

    handover.status = 'rejected';
    handover.rejectionReason = reason;
    await handover.save();

    await this.activityLog.record({
      actor: actor._id,
      action: 'handover.rejected',
      entity: 'handovers',
      entityId: id,
      metadata: { reason },
    });

    this.eventEmitter.emit('handover.status_changed', {
      projectId: String(handover.project),
      handoverId: id,
      status: 'rejected',
    });

    return handover;
  }
}
