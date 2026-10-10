import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NotificationsService } from './notifications.service';
import { User, UserDocument } from '../users/schemas/user.schema';
import { PERMISSIONS } from '@ti/shared';

@Injectable()
export class NotificationEventsService {
  private readonly logger = new Logger(NotificationEventsService.name);

  constructor(
    private notifications: NotificationsService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  private async tokensForPermission(permission: string): Promise<string[]> {
    const users = await this.userModel
      .find({ isActive: true, fcmToken: { $exists: true, $ne: '' } })
      .populate<{ role: { permissions: string[] } }>('role', 'permissions')
      .lean();

    return users
      .filter((u) => {
        const perms: string[] = (u.role as unknown as { permissions: string[] })?.permissions ?? [];
        return perms.includes(permission);
      })
      .map((u) => u.fcmToken)
      .filter(Boolean) as string[];
  }

  @OnEvent('approval.requested')
  async onApprovalRequested(payload: { approvalId: string; projectId: string; kind: string }) {
    try {
      const tokens = await this.tokensForPermission(PERMISSIONS.APPROVALS_DECIDE);
      if (!tokens.length) return;

      const kindLabel: Record<string, string> = {
        client_update: 'Client Update',
        quotation: 'Quotation',
        order_confirmation: 'Order Confirmation',
        drawing: 'Drawing',
      };

      await this.notifications.sendToMany(
        tokens,
        'Approval Requested',
        `A new ${kindLabel[payload.kind] ?? payload.kind} approval needs your review.`,
        { type: 'approval', approvalId: payload.approvalId, projectId: payload.projectId },
      );
    } catch (err) {
      this.logger.warn(`FCM approval.requested failed: ${(err as Error).message}`);
    }
  }

  @OnEvent('blocker.raised')
  async onBlockerRaised(payload: { blockerId: string; projectId: string; title: string }) {
    try {
      const tokens = await this.tokensForPermission(PERMISSIONS.BLOCKERS_TRIGGER_SLA);
      if (!tokens.length) return;

      await this.notifications.sendToMany(
        tokens,
        '🚫 Blocker Raised',
        payload.title,
        { type: 'blocker', blockerId: payload.blockerId, projectId: payload.projectId },
      );
    } catch (err) {
      this.logger.warn(`FCM blocker.raised failed: ${(err as Error).message}`);
    }
  }

  @OnEvent('handover.status_changed')
  async onHandoverStatusChanged(payload: {
    handoverId: string;
    projectId: string;
    status: string;
    toDepartmentId?: string;
  }) {
    try {
      const statusMessages: Record<string, { title: string; body: string }> = {
        confirmed: { title: 'Handover Confirmed', body: 'A handover is ready for your acceptance.' },
        accepted:  { title: 'Handover Accepted ✓', body: 'The handover was accepted — stage advancing.' },
        rejected:  { title: 'Handover Rejected', body: 'A handover was rejected. Check notes for details.' },
      };

      const notification = statusMessages[payload.status];
      if (!notification) return;

      const tokens = await this.tokensForPermission(PERMISSIONS.HANDOVERS_ACCEPT_TO);
      if (!tokens.length) return;

      await this.notifications.sendToMany(
        tokens,
        notification.title,
        notification.body,
        { type: 'handover', handoverId: payload.handoverId, projectId: payload.projectId },
      );
    } catch (err) {
      this.logger.warn(`FCM handover.status_changed failed: ${(err as Error).message}`);
    }
  }
}
