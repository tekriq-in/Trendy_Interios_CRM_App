import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './schemas/user.schema';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
export { CreateUserDto, UpdateUserDto };

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private activityLog: ActivityLogService,
  ) {}

  async findAll(query: { departmentId?: string; isActive?: boolean } = {}) {
    const filter: Record<string, unknown> = {};
    if (query.departmentId) filter.department = new Types.ObjectId(query.departmentId);
    if (query.isActive !== undefined) filter.isActive = query.isActive;

    return this.userModel
      .find(filter)
      .populate('role', 'name permissions')
      .populate('department', 'name')
      .populate('reportsTo', 'name email')
      .select('-passwordHash -refreshTokens -mfaSecret')
      .lean();
  }

  async findById(id: string) {
    const user = await this.userModel
      .findById(id)
      .populate('role', 'name permissions')
      .populate('department', 'name')
      .populate('reportsTo', 'name email')
      .select('-passwordHash -refreshTokens -mfaSecret')
      .lean();

    if (!user) throw new NotFoundException('user.not_found');
    return user;
  }

  async create(dto: CreateUserDto, actorId: string) {
    const existing = await this.userModel.findOne({ email: dto.email.toLowerCase() });
    if (existing) throw new ConflictException('user.email_taken');

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.userModel.create({
      name: dto.name,
      email: dto.email.toLowerCase(),
      phone: dto.phone,
      passwordHash,
      role: new Types.ObjectId(dto.roleId),
      department: dto.departmentId ? new Types.ObjectId(dto.departmentId) : undefined,
      reportsTo: dto.reportsToId ? new Types.ObjectId(dto.reportsToId) : undefined,
      preferredLanguage: dto.preferredLanguage ?? 'en',
      createdBy: new Types.ObjectId(actorId),
    });

    await this.activityLog.record({
      actor: actorId,
      action: 'user.created',
      entity: 'users',
      entityId: String(user._id),
      metadata: { email: user.email },
    });

    return this.findById(String(user._id));
  }

  async update(id: string, dto: UpdateUserDto, actorId: string) {
    const update: Record<string, unknown> = {};
    if (dto.name !== undefined) update.name = dto.name;
    if (dto.phone !== undefined) update.phone = dto.phone;
    if (dto.roleId !== undefined) update.role = new Types.ObjectId(dto.roleId);
    if (dto.departmentId !== undefined) update.department = new Types.ObjectId(dto.departmentId);
    if (dto.reportsToId !== undefined) update.reportsTo = new Types.ObjectId(dto.reportsToId);
    if (dto.preferredLanguage !== undefined) update.preferredLanguage = dto.preferredLanguage;
    if (dto.isActive !== undefined) update.isActive = dto.isActive;
    if (dto.fcmToken !== undefined) update.fcmToken = dto.fcmToken;

    const user = await this.userModel.findByIdAndUpdate(id, update, { new: true });
    if (!user) throw new NotFoundException('user.not_found');

    await this.activityLog.record({
      actor: actorId,
      action: 'user.updated',
      entity: 'users',
      entityId: id,
      metadata: update,
    });

    return this.findById(id);
  }

  async deactivate(id: string, actorId: string) {
    const user = await this.userModel.findByIdAndUpdate(id, { isActive: false }, { new: true });
    if (!user) throw new NotFoundException('user.not_found');

    await this.activityLog.record({
      actor: actorId,
      action: 'user.deactivated',
      entity: 'users',
      entityId: id,
    });

    return { success: true };
  }

  async getOrgChart() {
    const users = await this.userModel
      .find({ isActive: true })
      .populate('role', 'name')
      .populate('department', 'name')
      .select('-passwordHash -refreshTokens -mfaSecret')
      .lean();

    // Build tree
    const map = new Map(users.map((u) => [String(u._id), { ...u, children: [] as unknown[] }]));
    const roots: unknown[] = [];

    for (const user of map.values()) {
      const u = user as { reportsTo?: unknown; children: unknown[] };
      if (!u.reportsTo) {
        roots.push(user);
      } else {
        const parent = map.get(String(u.reportsTo));
        if (parent) parent.children.push(user);
        else roots.push(user);
      }
    }

    return roots;
  }

  async assignProject(userId: string, projectId: string) {
    await this.userModel.findByIdAndUpdate(userId, {
      $addToSet: { assignedProjects: new Types.ObjectId(projectId) },
    });
  }

  async unassignProject(userId: string, projectId: string) {
    await this.userModel.findByIdAndUpdate(userId, {
      $pull: { assignedProjects: new Types.ObjectId(projectId) },
    });
  }
}
