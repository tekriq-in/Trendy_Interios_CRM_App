import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Department, DepartmentDocument } from './schemas/department.schema';
import { ActivityLogService } from '../activity-log/activity-log.service';

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectModel(Department.name) private deptModel: Model<DepartmentDocument>,
    private activityLog: ActivityLogService,
  ) {}

  findAll() {
    return this.deptModel.find({ isActive: true }).sort({ order: 1 }).lean();
  }

  async findById(id: string) {
    const dept = await this.deptModel.findById(id).lean();
    if (!dept) throw new NotFoundException('department.not_found');
    return dept;
  }

  async create(
    dto: { name: string; description?: string; order: number; defaultSlaHours?: number },
    actorId: string,
  ) {
    const existing = await this.deptModel.findOne({ name: dto.name });
    if (existing) throw new ConflictException('department.name_taken');

    const dept = await this.deptModel.create({
      ...dto,
      isActive: true,
      createdBy: new Types.ObjectId(actorId),
    });

    await this.activityLog.record({
      actor: actorId,
      action: 'department.created',
      entity: 'departments',
      entityId: String(dept._id),
    });

    return dept;
  }

  async update(
    id: string,
    dto: { name?: string; description?: string; order?: number; defaultSlaHours?: number },
    actorId: string,
  ) {
    const dept = await this.deptModel.findByIdAndUpdate(id, dto, { new: true });
    if (!dept) throw new NotFoundException('department.not_found');

    await this.activityLog.record({
      actor: actorId,
      action: 'department.updated',
      entity: 'departments',
      entityId: id,
      metadata: dto,
    });

    return dept;
  }

  async deactivate(id: string, actorId: string) {
    const dept = await this.deptModel.findByIdAndUpdate(id, { isActive: false }, { new: true });
    if (!dept) throw new NotFoundException('department.not_found');

    await this.activityLog.record({
      actor: actorId,
      action: 'department.deactivated',
      entity: 'departments',
      entityId: id,
    });

    return { success: true };
  }
}
