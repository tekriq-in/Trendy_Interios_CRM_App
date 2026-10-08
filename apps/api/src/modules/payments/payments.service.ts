import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Payment, PaymentDocument } from './schemas/payment.schema';
import { ActivityLogService } from '../activity-log/activity-log.service';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    private activityLog: ActivityLogService,
  ) {}

  findByProject(projectId: string) {
    return this.paymentModel
      .find({ project: new Types.ObjectId(projectId) })
      .populate('collectedBy', 'name')
      .sort({ createdAt: -1 })
      .lean();
  }

  async findOverdue() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return this.paymentModel
      .find({
        paidAt: { $exists: false },
        createdAt: { $lt: thirtyDaysAgo },
      })
      .populate('project', 'title')
      .lean();
  }

  async record(
    projectId: string,
    dto: { kind: string; amount: number; paidAt?: Date; notes?: string },
    actorId: string,
  ) {
    const payment = await this.paymentModel.create({
      project: new Types.ObjectId(projectId),
      kind: dto.kind,
      amount: dto.amount,
      paidAt: dto.paidAt,
      collectedBy: new Types.ObjectId(actorId),
      notes: dto.notes,
      createdBy: new Types.ObjectId(actorId),
    });

    await this.activityLog.record({
      actor: actorId,
      action: 'payment.recorded',
      entity: 'payments',
      entityId: String(payment._id),
      metadata: { kind: dto.kind, amount: dto.amount },
    });

    return payment;
  }
}
