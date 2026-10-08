import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Approval, ApprovalDocument } from './schemas/approval.schema';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { PERMISSIONS } from '@ti/shared';

@Injectable()
export class ApprovalsService {
  constructor(
    @InjectModel(Approval.name) private approvalModel: Model<ApprovalDocument>,
    private activityLog: ActivityLogService,
  ) {}

  findPending() {
    return this.approvalModel
      .find({ status: 'pending' })
      .populate('project', 'title')
      .populate('requestedBy', 'name email')
      .sort({ createdAt: 1 })
      .lean();
  }

  async request(
    dto: { projectId: string; kind: string; linkedDocumentId?: string },
    actor: { _id: string; rolePermissions: string[] },
  ) {
    if (!actor.rolePermissions.includes(PERMISSIONS.APPROVALS_REQUEST)) {
      throw new ForbiddenException('auth.insufficient_permissions');
    }

    const approval = await this.approvalModel.create({
      project: new Types.ObjectId(dto.projectId),
      kind: dto.kind,
      requestedBy: new Types.ObjectId(actor._id),
      linkedDocument: dto.linkedDocumentId ? new Types.ObjectId(dto.linkedDocumentId) : undefined,
      createdBy: new Types.ObjectId(actor._id),
    });

    await this.activityLog.record({
      actor: actor._id,
      action: 'approval.requested',
      entity: 'approvals',
      entityId: String(approval._id),
      metadata: { kind: dto.kind },
    });

    return approval;
  }

  async approve(id: string, actor: { _id: string; rolePermissions: string[] }) {
    if (!actor.rolePermissions.includes(PERMISSIONS.APPROVALS_DECIDE)) {
      throw new ForbiddenException('auth.insufficient_permissions');
    }

    const approval = await this.approvalModel.findByIdAndUpdate(
      id,
      {
        status: 'approved',
        approver: new Types.ObjectId(actor._id),
        approvedAt: new Date(),
      },
      { new: true },
    );
    if (!approval) throw new NotFoundException('approval.not_found');

    await this.activityLog.record({
      actor: actor._id,
      action: 'approval.approved',
      entity: 'approvals',
      entityId: id,
      metadata: { kind: approval.kind },
    });

    return approval;
  }

  async reject(id: string, reason: string, actor: { _id: string; rolePermissions: string[] }) {
    if (!actor.rolePermissions.includes(PERMISSIONS.APPROVALS_DECIDE)) {
      throw new ForbiddenException('auth.insufficient_permissions');
    }

    const approval = await this.approvalModel.findByIdAndUpdate(
      id,
      {
        status: 'rejected',
        approver: new Types.ObjectId(actor._id),
        rejectionReason: reason,
      },
      { new: true },
    );
    if (!approval) throw new NotFoundException('approval.not_found');

    await this.activityLog.record({
      actor: actor._id,
      action: 'approval.rejected',
      entity: 'approvals',
      entityId: id,
      metadata: { reason },
    });

    return approval;
  }
}
