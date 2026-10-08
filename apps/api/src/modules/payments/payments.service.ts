import { Injectable, NotFoundException, Inject, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron } from '@nestjs/schedule';
import { Payment, PaymentDocument } from './schemas/payment.schema';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { WHATSAPP_SERVICE, IWhatsAppService } from '../whatsapp/whatsapp.interface';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    private activityLog: ActivityLogService,
    @Inject(WHATSAPP_SERVICE) private whatsapp: IWhatsAppService,
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

  async triggerFollowUp(paymentId: string, actorId: string) {
    const payment = await this.paymentModel
      .findById(paymentId)
      .populate({ path: 'project', populate: { path: 'client', select: 'phone name' } });

    if (!payment) throw new NotFoundException('payment.not_found');

    const project = payment.project as unknown as { title: string; client: { phone: string; name: string } };
    if (project?.client?.phone) {
      await this.whatsapp.sendTemplate(
        project.client.phone,
        'payment_followup',
        [
          project.client.name ?? 'Customer',
          String(payment.amount),
          project.title ?? 'your project',
        ],
      );
    }

    payment.followUpSentAt = new Date();
    payment.followUpApprovedBy = new Types.ObjectId(actorId);
    await payment.save();

    await this.activityLog.record({
      actor: actorId,
      action: 'payment.followup_sent',
      entity: 'payments',
      entityId: paymentId,
      metadata: { amount: payment.amount },
    });

    return payment;
  }

  @Cron('0 9 * * *')
  async runDailyFollowUps() {
    const overdue = await this.findOverdue();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    for (const payment of overdue) {
      const needsFollowUp =
        !payment.followUpSentAt ||
        new Date(payment.followUpSentAt) < sevenDaysAgo;
      if (needsFollowUp) {
        try {
          await this.triggerFollowUp(String(payment._id), 'system');
        } catch (err) {
          this.logger.warn(`Follow-up failed for payment ${payment._id}: ${err.message}`);
        }
      }
    }
  }
}
