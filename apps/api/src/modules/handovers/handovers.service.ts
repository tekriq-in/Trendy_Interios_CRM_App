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
import { ProjectAccessService, type Actor } from '../../common/access/project-access.service';

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
}

/** The signed-in user. `department` comes from the user record (set by the JWT strategy). */
export type HandoverActor = Actor & { department?: unknown };

@Injectable()
export class HandoversService {
  constructor(
    @InjectModel(Handover.name) private handoverModel: Model<HandoverDocument>,
    private activityLog: ActivityLogService,
    private eventEmitter: EventEmitter2,
    private access: ProjectAccessService,
  ) {}

  /**
   * Handovers the actor may see. Roles with projects:read_all see all; everyone else
   * only the handovers of projects they are assigned to. (This used to return every
   * project's handovers to any logged-in user.)
   */
  async findAll(actor: HandoverActor, projectId?: string) {
    if (projectId !== undefined && !Types.ObjectId.isValid(projectId)) {
      throw new NotFoundException('project.not_found');
    }
    const visible = await this.access.visibleProjectIds(actor); // null = every project
    let match: Record<string, unknown> = {};
    if (visible) {
      // Own projects, plus (for leads) any handover to or from their own department.
      const reach: Record<string, unknown>[] = [{ project: { $in: visible } }];
      const dept = this.leadDepartment(actor);
      if (dept) reach.push({ fromDepartment: dept }, { toDepartment: dept });
      match = reach.length === 1 ? reach[0] : { $or: reach };
    }
    if (projectId) {
      const byProject = { project: new Types.ObjectId(projectId) };
      match = visible ? { $and: [match, byProject] } : byProject;
    }

    return this.handoverModel.aggregate([
      { $match: match },
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: 'projects',
          let: { pid: '$project' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$pid'] } } },
            { $project: { _id: 1, title: 1 } },
          ],
          as: 'projectArr',
        },
      },
      {
        $lookup: {
          from: 'departments',
          let: { fid: '$fromDepartment' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$fid'] } } },
            { $project: { _id: 1, name: 1 } },
          ],
          as: 'fromDepartmentArr',
        },
      },
      {
        $lookup: {
          from: 'departments',
          let: { tid: '$toDepartment' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$tid'] } } },
            { $project: { _id: 1, name: 1 } },
          ],
          as: 'toDepartmentArr',
        },
      },
      {
        $lookup: {
          from: 'users',
          let: { uid: '$raisedBy' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$uid'] } } },
            { $project: { _id: 1, name: 1, email: 1 } },
          ],
          as: 'raisedByArr',
        },
      },
      {
        $lookup: {
          from: 'tidocuments',
          let: { pfids: '$proofFiles' },
          pipeline: [
            { $match: { $expr: { $in: ['$_id', { $ifNull: ['$$pfids', []] }] } } },
            { $project: { _id: 1, fileName: 1, driveLink: 1, mimeType: 1, type: 1 } },
          ],
          as: 'proofFilesArr',
        },
      },
      {
        $addFields: {
          project: { $arrayElemAt: ['$projectArr', 0] },
          fromDepartment: { $arrayElemAt: ['$fromDepartmentArr', 0] },
          toDepartment: { $arrayElemAt: ['$toDepartmentArr', 0] },
          raisedBy: { $arrayElemAt: ['$raisedByArr', 0] },
          proofFiles: '$proofFilesArr',
        },
      },
      { $unset: ['projectArr', 'fromDepartmentArr', 'toDepartmentArr', 'raisedByArr', 'proofFilesArr'] },
    ]);
  }

  async raise(
    dto: {
      projectId: string;
      fromDepartmentId: string;
      toDepartmentId: string;
      proofFileIds: string[];
      notes?: string;
      clientRequestId?: string;
    },
    actor: { _id: string; rolePermissions: string[] },
  ) {
    if (!actor.rolePermissions.includes(PERMISSIONS.HANDOVERS_RAISE)) {
      throw new ForbiddenException('auth.insufficient_permissions');
    }
    await this.access.assertAccess(dto.projectId, actor);

    if (dto.clientRequestId) {
      const existing = await this.handoverModel.findOne({
        clientRequestId: dto.clientRequestId,
        raisedBy: new Types.ObjectId(actor._id),
      });
      if (existing) return existing;
    }

    if (!dto.proofFileIds || dto.proofFileIds.length === 0) {
      throw new BadRequestException('handover.proof_required');
    }

    let handover: HandoverDocument;
    try {
      handover = await this.handoverModel.create({
        project: new Types.ObjectId(dto.projectId),
        fromDepartment: new Types.ObjectId(dto.fromDepartmentId),
        toDepartment: new Types.ObjectId(dto.toDepartmentId),
        raisedBy: new Types.ObjectId(actor._id),
        proofFiles: dto.proofFileIds.map((id) => new Types.ObjectId(id)),
        clientRequestId: dto.clientRequestId,
        notes: dto.notes,
        status: 'draft',
        createdBy: new Types.ObjectId(actor._id),
      });
    } catch (error) {
      if (dto.clientRequestId && isDuplicateKeyError(error)) {
        const existing = await this.handoverModel.findOne({
          clientRequestId: dto.clientRequestId,
          raisedBy: new Types.ObjectId(actor._id),
        });
        if (existing) return existing;
      }
      throw error;
    }

    await this.activityLog.record({
      actor: actor._id,
      action: 'handover.raised',
      entity: 'handovers',
      entityId: String(handover._id),
    });

    return handover;
  }

  async confirm(id: string, actor: HandoverActor) {
    if (!actor.rolePermissions.includes(PERMISSIONS.HANDOVERS_CONFIRM_FROM)) {
      throw new ForbiddenException('auth.insufficient_permissions');
    }

    const handover = await this.handoverModel.findById(id);
    if (!handover) throw new NotFoundException('handover.not_found');
    await this.assertHandoverAccess(handover, actor, 'from');
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

  async accept(id: string, actor: HandoverActor) {
    if (!actor.rolePermissions.includes(PERMISSIONS.HANDOVERS_ACCEPT_TO)) {
      throw new ForbiddenException('auth.insufficient_permissions');
    }

    const handover = await this.handoverModel.findById(id);
    if (!handover) throw new NotFoundException('handover.not_found');
    await this.assertHandoverAccess(handover, actor, 'to');
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

  async reject(id: string, reason: string, actor: HandoverActor) {
    if (!actor.rolePermissions.includes(PERMISSIONS.HANDOVERS_ACCEPT_TO)) {
      throw new ForbiddenException('auth.insufficient_permissions');
    }

    if (!reason?.trim()) throw new BadRequestException('handover.reason_required');

    const handover = await this.handoverModel.findById(id);
    if (!handover) throw new NotFoundException('handover.not_found');
    await this.assertHandoverAccess(handover, actor, 'to');
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

  /**
   * Department of an actor who leads a team (can confirm or accept handovers), or null.
   * The SOW flow is lead to lead: the sending lead confirms, the receiving lead accepts.
   * Project assignment is managed by hand, so those leads must still reach handovers of
   * their own department even when they are not named on the project. Plain employees
   * never get this: they only reach their assigned projects.
   */
  private leadDepartment(actor: HandoverActor): Types.ObjectId | null {
    const isLead =
      actor.rolePermissions.includes(PERMISSIONS.HANDOVERS_CONFIRM_FROM) ||
      actor.rolePermissions.includes(PERMISSIONS.HANDOVERS_ACCEPT_TO);
    const dept = actor.department ? String(actor.department) : '';
    return isLead && Types.ObjectId.isValid(dept) ? new Types.ObjectId(dept) : null;
  }

  /**
   * May the actor act on this handover? Yes for a lead of the sending department
   * ('from': confirm) or the receiving department ('to': accept or reject); otherwise
   * only if they can see the handover's project (404 if not).
   */
  private async assertHandoverAccess(
    handover: { project: unknown; fromDepartment: unknown; toDepartment: unknown },
    actor: HandoverActor,
    side: 'from' | 'to',
  ) {
    const dept = this.leadDepartment(actor);
    const target = side === 'from' ? handover.fromDepartment : handover.toDepartment;
    if (dept && target && String(target) === String(dept)) return;
    await this.access.assertAccess(String(handover.project), actor);
  }

  async createDraft(dto: {
    projectId: string;
    fromDepartmentId: string;
    toDepartmentId: string;
    raisedById: string;
  }): Promise<void> {
    await this.handoverModel.create({
      project: new Types.ObjectId(dto.projectId),
      fromDepartment: new Types.ObjectId(dto.fromDepartmentId),
      toDepartment: new Types.ObjectId(dto.toDepartmentId),
      raisedBy: new Types.ObjectId(dto.raisedById),
      status: 'draft',
      createdBy: new Types.ObjectId(dto.raisedById),
    });
  }
}
