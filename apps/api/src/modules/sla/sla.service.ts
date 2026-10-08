import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SlaSettings, SlaSettingsDocument } from './schemas/sla-settings.schema';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { PERMISSIONS } from '@ti/shared';

@Injectable()
export class SlaService {
  constructor(
    @InjectModel(SlaSettings.name) private slaModel: Model<SlaSettingsDocument>,
    private activityLog: ActivityLogService,
  ) {}

  findAll() {
    return this.slaModel.find().populate('department', 'name order').lean();
  }

  async update(
    departmentId: string,
    defaultHours: number,
    actor: { _id: string; rolePermissions: string[] },
  ) {
    if (!actor.rolePermissions.includes(PERMISSIONS.SLA_EDIT)) {
      throw new ForbiddenException('auth.insufficient_permissions');
    }

    const sla = await this.slaModel.findOneAndUpdate(
      { department: new Types.ObjectId(departmentId) },
      {
        defaultHours,
        updatedBy: new Types.ObjectId(actor._id),
      },
      { new: true, upsert: true },
    );

    await this.activityLog.record({
      actor: actor._id,
      action: 'sla.updated',
      entity: 'slaSettings',
      entityId: String(sla._id),
      metadata: { departmentId, defaultHours },
    });

    return sla;
  }
}
