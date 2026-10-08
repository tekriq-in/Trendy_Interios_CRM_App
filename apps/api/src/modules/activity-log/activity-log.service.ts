import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ActivityLog, ActivityLogDocument } from './schemas/activity-log.schema';

export interface RecordDto {
  actor: string;
  action: string;
  entity: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class ActivityLogService {
  constructor(
    @InjectModel(ActivityLog.name) private logModel: Model<ActivityLogDocument>,
  ) {}

  async record(dto: RecordDto): Promise<void> {
    await this.logModel.create({
      actor: new Types.ObjectId(dto.actor),
      action: dto.action,
      entity: dto.entity,
      entityId: new Types.ObjectId(dto.entityId),
      metadata: dto.metadata,
      createdBy: new Types.ObjectId(dto.actor),
    });
  }

  async findAll(
    query: { actorId?: string; entity?: string; from?: string; to?: string },
    page = 1,
    limit = 50,
    userPermissions: string[] = [],
  ) {
    if (!userPermissions.includes('activity_log:read')) {
      throw new ForbiddenException('auth.insufficient_permissions');
    }

    const filter: Record<string, unknown> = {};
    if (query.actorId) filter.actor = new Types.ObjectId(query.actorId);
    if (query.entity) filter.entity = query.entity;
    if (query.from || query.to) {
      filter.createdAt = {};
      if (query.from) (filter.createdAt as Record<string, Date>)['$gte'] = new Date(query.from);
      if (query.to) (filter.createdAt as Record<string, Date>)['$lte'] = new Date(query.to);
    }

    const [data, total] = await Promise.all([
      this.logModel
        .find(filter)
        .populate('actor', 'name email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.logModel.countDocuments(filter),
    ]);

    return { data, total, page, limit };
  }
}
