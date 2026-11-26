import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Department, DepartmentDocument } from './schemas/department.schema';
import { SlaSettings, SlaSettingsDocument } from '../sla/schemas/sla-settings.schema';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { ChatGroupsService } from '../chat-groups/chat-groups.service';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto';

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectModel(Department.name) private deptModel: Model<DepartmentDocument>,
    @InjectModel(SlaSettings.name) private slaModel: Model<SlaSettingsDocument>,
    private activityLog: ActivityLogService,
    private chatGroups: ChatGroupsService,
  ) {}

  findAll(includeInactive = false) {
    const filter = includeInactive ? {} : { isActive: true };
    return this.deptModel.find(filter).sort({ order: 1 }).lean();
  }

  async findById(id: string) {
    const dept = await this.deptModel.findById(id).lean();
    if (!dept) throw new NotFoundException('department.not_found');
    return dept;
  }

  async create(dto: CreateDepartmentDto, actorId: string) {
    const existing = await this.deptModel.findOne({ name: dto.name });
    if (existing) throw new ConflictException('department.name_taken');

    const dept = await this.deptModel.create({
      ...dto,
      isActive: true,
      createdBy: new Types.ObjectId(actorId),
    });

    await this.slaModel.updateOne(
      { department: dept._id },
      { $set: { defaultHours: dept.defaultSlaHours } },
      { upsert: true },
    );

    await this.activityLog.record({
      actor: actorId,
      action: 'department.created',
      entity: 'departments',
      entityId: String(dept._id),
    });

    // Auto-create a chat group for every new department
    await this.chatGroups.autoCreateForDepartment(String(dept._id), dept.name).catch(() => {});

    return dept;
  }

  async update(id: string, dto: UpdateDepartmentDto, actorId: string) {
    const dept = await this.deptModel.findByIdAndUpdate(id, { $set: dto }, { new: true });
    if (!dept) throw new NotFoundException('department.not_found');

    if (dto.defaultSlaHours !== undefined) {
      await this.slaModel.updateOne(
        { department: dept._id },
        { $set: { defaultHours: dto.defaultSlaHours } },
        { upsert: true },
      );
    }

    await this.activityLog.record({
      actor: actorId,
      action: 'department.updated',
      entity: 'departments',
      entityId: id,
      metadata: { ...dto },
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
