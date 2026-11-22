import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './schemas/user.schema';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { CreateUserDto, ResetPasswordDto, UpdateUserDto } from './dto/user.dto';
import { ChatGroupsService } from '../chat-groups/chat-groups.service';
import { PERMISSIONS } from '@ti/shared';
import { Role, RoleDocument } from '../roles/schemas/role.schema';
import { Project, ProjectDocument } from '../projects/schemas/project.schema';
import { Task, TaskDocument } from '../tasks/schemas/task.schema';
import { TIDocument, DocumentDoc } from '../documents/schemas/document.schema';
import { Handover, HandoverDocument } from '../handovers/schemas/handover.schema';
import { Blocker, BlockerDocument } from '../blockers/schemas/blocker.schema';
import { Approval, ApprovalDocument } from '../approvals/schemas/approval.schema';
import { PurchaseItem, PurchaseItemDocument } from '../purchase-items/schemas/purchase-item.schema';
import { ShadeCardEntry, ShadeCardEntryDocument } from '../shade-card/schemas/shade-card.schema';
import { ChatGroup, ChatGroupDocument } from '../chat-groups/chat-group.schema';
import { Message, MessageDocument } from '../messages/messages.schema';
import { SlaSettings, SlaSettingsDocument } from '../sla/schemas/sla-settings.schema';
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
    @InjectModel(Role.name) private roleModel: Model<RoleDocument>,
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
    @InjectModel(Task.name) private taskModel: Model<TaskDocument>,
    @InjectModel(TIDocument.name) private documentModel: Model<DocumentDoc>,
    @InjectModel(Handover.name) private handoverModel: Model<HandoverDocument>,
    @InjectModel(Blocker.name) private blockerModel: Model<BlockerDocument>,
    @InjectModel(Approval.name) private approvalModel: Model<ApprovalDocument>,
    @InjectModel(PurchaseItem.name) private purchaseItemModel: Model<PurchaseItemDocument>,
    @InjectModel(ShadeCardEntry.name) private shadeCardModel: Model<ShadeCardEntryDocument>,
    @InjectModel(ChatGroup.name) private chatGroupModel: Model<ChatGroupDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(SlaSettings.name) private slaSettingsModel: Model<SlaSettingsDocument>,
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

  async deleteAllPermanently(actorId: string) {
    const adminRoles = await this.roleModel
      .find()
      .select('_id name')
      .lean();
    const protectedRoleIds = adminRoles
      .filter((role) => role.name.toUpperCase() === 'MD')
      .map((role) => role._id);
    const employees = await this.userModel
      .find({
        role: { $nin: protectedRoleIds },
        _id: { $ne: new Types.ObjectId(actorId) },
      })
      .select('_id')
      .lean();

    await this.messageModel.deleteMany({});
    await this.chatGroupModel.deleteMany({});

    for (const employee of employees) {
      await this.deletePermanently(String(employee._id), actorId);
    }

    return { success: true, deletedCount: employees.length };
  }

  async deletePermanently(id: string, actorId: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('user.not_found');
    if (id === actorId) throw new ForbiddenException('user.cannot_delete_self');

    const userId = new Types.ObjectId(id);
    const db = this.userModel.db.db;
    if (!db) throw new ServiceUnavailableException('database.unavailable');

    const hello = await db.admin().command({ hello: 1 });
    const supportsTransactions = Boolean(
      hello.setName || hello.msg === 'isdbgrid' || hello.serviceId,
    );
    const session = await this.userModel.db.startSession();

    const deleteEmployeeData = async (transactionSession?: ClientSession) => {
      const options = transactionSession ? { session: transactionSession } : {};
      const userQuery = this.userModel.findById(userId).select('role');
      if (transactionSession) userQuery.session(transactionSession);
      const employee = await userQuery.lean();
      if (!employee) throw new NotFoundException('user.not_found');

      const roleQuery = this.roleModel.findById(employee.role).select('name');
      if (transactionSession) roleQuery.session(transactionSession);
      const role = await roleQuery.lean();
      if (role && role.name.toUpperCase() === 'MD') {
        throw new ForbiddenException('user.cannot_delete_admin');
      }

      const documentsQuery = this.documentModel
        .find({ $or: [{ uploadedBy: userId }, { createdBy: userId }] })
        .select('_id');
      if (transactionSession) documentsQuery.session(transactionSession);
      const documents = await documentsQuery.lean();
      const documentIds = documents.map((document) => document._id);

      const groupsQuery = this.chatGroupModel
        .find({ members: userId })
        .select('_id channel type');
      if (transactionSession) groupsQuery.session(transactionSession);
      const groups = await groupsQuery.lean();
      const directGroups = groups.filter((group) => group.type === 'individual');
      const directGroupIds = directGroups.map((group) => group._id);
      const directChannels = directGroups.map((group) => group.channel);
      const userHexId = userId.toHexString();
      const directMessageChannel = new RegExp(
        `^dm:(?:${userHexId}_[0-9a-f]{24}|[0-9a-f]{24}_${userHexId})$`,
        'i',
      );

      await this.taskModel.deleteMany(
        { $or: [{ assignedTo: userId }, { createdBy: userId }] },
        options,
      );
      await this.documentModel.deleteMany(
        { _id: { $in: documentIds } },
        options,
      );
      await this.handoverModel.deleteMany(
        {
          $or: [
            { raisedBy: userId },
            { confirmedBy: userId },
            { acceptedBy: userId },
            { createdBy: userId },
            ...(documentIds.length > 0 ? [{ proofFiles: { $in: documentIds } }] : []),
          ],
        },
        options,
      );
      await this.blockerModel.deleteMany({
        $or: [
          { raisedBy: userId },
          { slaTriggeredBy: userId },
          { resolvedBy: userId },
          { createdBy: userId },
        ],
      }, options);
      await this.approvalModel.deleteMany(
        {
          $or: [
            { requestedBy: userId },
            { approver: userId },
            { createdBy: userId },
            ...(documentIds.length > 0 ? [{ linkedDocument: { $in: documentIds } }] : []),
          ],
        },
        options,
      );
      await this.purchaseItemModel.deleteMany({ createdBy: userId }, options);
      await this.shadeCardModel.deleteMany({ createdBy: userId }, options);
      await this.messageModel.deleteMany(
        {
          $or: [
            { sender: userId },
            { channel: { $in: directChannels } },
            { channel: { $regex: directMessageChannel } },
          ],
        },
        options,
      );
      await this.messageModel.updateMany(
        {
          $or: [
            { mentions: userId },
            { 'readBy.user': userId },
            { attachments: { $in: documentIds } },
          ],
        },
        {
          $pull: {
            mentions: userId,
            readBy: { user: userId },
            attachments: { $in: documentIds },
          },
        },
        options,
      );

      if (directGroupIds.length > 0) {
        await this.chatGroupModel.deleteMany({ _id: { $in: directGroupIds } }, options);
      }
      await this.chatGroupModel.updateMany(
        { members: userId },
        { $pull: { members: userId } },
        options,
      );
      await this.projectModel.updateMany(
        { assignedTeam: userId },
        { $pull: { assignedTeam: userId } },
        options,
      );
      await this.slaSettingsModel.updateMany(
        { updatedBy: userId },
        { $unset: { updatedBy: '' } },
        options,
      );
      await this.userModel.updateMany(
        { reportsTo: userId },
        { $unset: { reportsTo: '', createdBy: '' } },
        options,
      );

      for (const collection of Object.values(this.userModel.db.collections)) {
        if (collection.collectionName === 'activitylogs') continue;
        await collection.updateMany(
          { createdBy: userId },
          { $unset: { createdBy: '' } },
          options,
        );
      }

      const result = await this.userModel.deleteOne({ _id: userId }, options);
      if (result.deletedCount !== 1) throw new NotFoundException('user.not_found');
    };

    try {
      if (supportsTransactions) {
        await session.withTransaction(() => deleteEmployeeData(session));
      } else {
        await deleteEmployeeData();
      }
      return { success: true };
    } finally {
      await session.endSession();
    }
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
