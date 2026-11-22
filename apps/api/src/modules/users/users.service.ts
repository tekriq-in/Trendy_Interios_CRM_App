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
import { CreateUserDto, ResetPasswordDto, UpdateUserDto } from './dto/user.dto';
import { ChatGroupsService } from '../chat-groups/chat-groups.service';
import { PERMISSIONS } from '@ti/shared';
export { CreateUserDto, ResetPasswordDto, UpdateUserDto };

function getDuplicateUserField(error: unknown): 'phone' | 'email' | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error) || error.code !== 11000) {
    return undefined;
  }

  const keyPattern = 'keyPattern' in error && typeof error.keyPattern === 'object' && error.keyPattern
    ? error.keyPattern
    : {};
  const keyValue = 'keyValue' in error && typeof error.keyValue === 'object' && error.keyValue
    ? error.keyValue
    : {};

  if ('phone' in keyPattern || 'phone' in keyValue) return 'phone';
  if ('email' in keyPattern || 'email' in keyValue) return 'email';
  return undefined;
}

function throwDuplicateUserConflict(error: unknown): never {
  const field = getDuplicateUserField(error);
  if (field === 'phone') throw new ConflictException('Phone number already exists.');
  if (field === 'email') throw new ConflictException('Email address already exists.');
  throw error;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private activityLog: ActivityLogService,
    private chatGroups: ChatGroupsService,
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

  findForDashboard(actor: { _id: string; rolePermissions: string[] }) {
    const filter: Record<string, unknown> = { isActive: true };
    if (!actor.rolePermissions.includes(PERMISSIONS.PROJECTS_READ_ALL)) {
      filter._id = new Types.ObjectId(actor._id);
    }

    return this.userModel
      .find(filter)
      .select('_id name department isActive')
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
    if (dto.phone && await this.userModel.findOne({ phone: dto.phone })) {
      throw new ConflictException('Phone number already exists.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    let user: UserDocument;
    try {
      user = await this.userModel.create({
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
    } catch (error: unknown) {
      throwDuplicateUserConflict(error);
    }

    if (dto.departmentId) {
      await this.chatGroups.addDepartmentMember(dto.departmentId, String(user._id));
    }

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
    if (dto.phone) {
      const existingPhone = await this.userModel.findOne({
        phone: dto.phone,
        _id: { $ne: new Types.ObjectId(id) },
      });
      if (existingPhone) throw new ConflictException('Phone number already exists.');
    }

    const existingUser = dto.departmentId !== undefined
      ? await this.userModel.findById(id).select('department')
      : null;
    if (dto.departmentId !== undefined && !existingUser) {
      throw new NotFoundException('user.not_found');
    }

    const update: Record<string, unknown> = {};
    if (dto.name !== undefined) update.name = dto.name;
    if (dto.phone !== undefined) update.phone = dto.phone;
    if (dto.roleId !== undefined) update.role = new Types.ObjectId(dto.roleId);
    if (dto.departmentId !== undefined) update.department = dto.departmentId ? new Types.ObjectId(dto.departmentId) : null;
    if (dto.reportsToId !== undefined) update.reportsTo = new Types.ObjectId(dto.reportsToId);
    if (dto.preferredLanguage !== undefined) update.preferredLanguage = dto.preferredLanguage;
    if (dto.isActive !== undefined) update.isActive = dto.isActive;
    if (dto.fcmToken !== undefined) update.fcmToken = dto.fcmToken;

    let user: UserDocument | null;
    try {
      user = await this.userModel.findByIdAndUpdate(id, update, { new: true });
    } catch (error: unknown) {
      throwDuplicateUserConflict(error);
    }
    if (!user) throw new NotFoundException('user.not_found');

    if (existingUser) {
      const previousDepartmentId = existingUser.department ? String(existingUser.department) : undefined;
      const nextDepartmentId = dto.departmentId || undefined;
      if (previousDepartmentId !== nextDepartmentId) {
        if (previousDepartmentId) {
          await this.chatGroups.removeDepartmentMember(previousDepartmentId, id);
        }
        if (nextDepartmentId) {
          await this.chatGroups.addDepartmentMember(nextDepartmentId, id);
        }
      }
    }

    await this.activityLog.record({
      actor: actorId,
      action: 'user.updated',
      entity: 'users',
      entityId: id,
      metadata: update,
    });

    return this.findById(id);
  }

  async resetPassword(id: string, dto: ResetPasswordDto, actorId: string) {
    if (!dto.password || !dto.confirmPassword) {
      throw new BadRequestException('Password and password confirmation are required.');
    }
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Password confirmation does not match.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.userModel.findByIdAndUpdate(
      id,
      { passwordHash, mustChangePassword: true, refreshTokens: [] },
      { new: true },
    );
    if (!user) throw new NotFoundException('user.not_found');

    await this.activityLog.record({
      actor: actorId,
      action: 'user.password_reset',
      entity: 'users',
      entityId: id,
    });

    return { success: true };
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
