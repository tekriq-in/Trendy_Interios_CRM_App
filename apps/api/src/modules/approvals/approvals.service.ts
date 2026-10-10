import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Approval, ApprovalDocument } from './schemas/approval.schema';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { PERMISSIONS } from '@ti/shared';
import { WHATSAPP_SERVICE, IWhatsAppService } from '../whatsapp/whatsapp.interface';
import { MessageGeneratorService, GenerateMessageDto } from '../message-generator/message-generator.service';

@Injectable()
export class ApprovalsService {
  constructor(
    @InjectModel(Approval.name) private approvalModel: Model<ApprovalDocument>,
    private activityLog: ActivityLogService,
    @Inject(WHATSAPP_SERVICE) private whatsapp: IWhatsAppService,
    private messageGenerator: MessageGeneratorService,
    private eventEmitter: EventEmitter2,
  ) {}

  findAll() {
    return this.approvalModel
      .find()
      .populate('project', 'title')
      .populate('requestedBy', 'name email')
      .populate('approver', 'name')
      .sort({ createdAt: -1 })
      .lean();
  }

  findPending() {
    return this.approvalModel
      .find({ status: 'pending' })
      .populate('project', 'title')
      .populate('requestedBy', 'name email')
      .sort({ createdAt: 1 })
      .lean();
  }

  async generateMessage(dto: GenerateMessageDto) {
    const message = await this.messageGenerator.generate(dto);
    return { message };
  }

  async request(
    dto: {
      projectId: string;
      kind: string;
      rawNotes?: string;
      generatedMessage?: string;
      linkedDocumentId?: string;
    },
    actor: { _id: string; rolePermissions: string[] },
  ) {
    if (!actor.rolePermissions.includes(PERMISSIONS.APPROVALS_REQUEST)) {
      throw new ForbiddenException('auth.insufficient_permissions');
    }

    if (dto.kind === 'client_update' && !dto.generatedMessage?.trim()) {
      throw new BadRequestException('approval.client_update_requires_generated_message');
    }

    const approval = await this.approvalModel.create({
      project: new Types.ObjectId(dto.projectId),
      kind: dto.kind,
      rawNotes: dto.rawNotes?.trim(),
      generatedMessage: dto.generatedMessage?.trim(),
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

    this.eventEmitter.emit('approval.requested', {
      approvalId: String(approval._id),
      projectId: dto.projectId,
      kind: dto.kind,
      requestedBy: actor._id,
    });

    return approval;
  }

  async approve(id: string, dto: { finalMessage?: string }, actor: { _id: string; rolePermissions: string[] }) {
    if (!actor.rolePermissions.includes(PERMISSIONS.APPROVALS_DECIDE)) {
      throw new ForbiddenException('auth.insufficient_permissions');
    }

    const approval = await this.approvalModel.findByIdAndUpdate(
      id,
      {
        status: 'approved',
        approver: new Types.ObjectId(actor._id),
        approvedAt: new Date(),
        ...(dto.finalMessage ? { generatedMessage: dto.finalMessage.trim() } : {}),
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

    if (approval.kind === 'client_update') {
      await approval.populate({
        path: 'project',
        populate: { path: 'client', select: 'phone name whatsappOptIn' },
      });
      const project = approval.project as unknown as {
        title: string;
        client: { phone: string; name: string; whatsappOptIn: boolean };
      };

      if (project?.client?.phone) {
        const messageBody = approval.generatedMessage?.trim() ||
          `Dear ${project.client.name}, your project "${project.title}" has an update from the team. — Team Trendy Interios`;

        await this.whatsapp.sendMessage(project.client.phone, messageBody);
        approval.whatsappScheduled = true;
        await approval.save();
      }
    }

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
