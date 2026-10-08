import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Role, RoleDocument } from './schemas/role.schema';
import { ActivityLogService } from '../activity-log/activity-log.service';

@Injectable()
export class RolesService {
  constructor(
    @InjectModel(Role.name) private roleModel: Model<RoleDocument>,
    private activityLog: ActivityLogService,
  ) {}

  findAll() {
    return this.roleModel.find().lean();
  }

  async findById(id: string) {
    const role = await this.roleModel.findById(id).lean();
    if (!role) throw new NotFoundException('role.not_found');
    return role;
  }

  async create(dto: { name: string; permissions: string[] }, actorId: string) {
    const existing = await this.roleModel.findOne({ name: dto.name });
    if (existing) throw new ConflictException('role.name_taken');

    const role = await this.roleModel.create({ ...dto, isSystem: false });
    await this.activityLog.record({
      actor: actorId,
      action: 'role.created',
      entity: 'roles',
      entityId: String(role._id),
    });
    return role;
  }

  async update(id: string, dto: { name?: string; permissions?: string[] }, actorId: string) {
    const role = await this.roleModel.findByIdAndUpdate(id, dto, { new: true });
    if (!role) throw new NotFoundException('role.not_found');
    await this.activityLog.record({
      actor: actorId,
      action: 'role.updated',
      entity: 'roles',
      entityId: id,
      metadata: dto,
    });
    return role;
  }

  async remove(id: string, actorId: string) {
    const role = await this.roleModel.findById(id);
    if (!role) throw new NotFoundException('role.not_found');
    if (role.isSystem) throw new BadRequestException('role.cannot_delete_system_role');

    await this.roleModel.findByIdAndDelete(id);
    await this.activityLog.record({
      actor: actorId,
      action: 'role.deleted',
      entity: 'roles',
      entityId: id,
    });
    return { success: true };
  }
}
