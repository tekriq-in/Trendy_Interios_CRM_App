import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ChatGroup, ChatGroupDocument, ChatGroupType } from './chat-group.schema';

export interface CreateGroupDto {
  name: string;
  memberIds: string[];
}

@Injectable()
export class ChatGroupsService {
  constructor(
    @InjectModel(ChatGroup.name) private groupModel: Model<ChatGroupDocument>,
  ) {}

  async findForUser(userId: string): Promise<ChatGroupDocument[]> {
    return this.groupModel
      .find({ members: new Types.ObjectId(userId), isActive: true })
      .populate('members', 'name email')
      .populate('projectRef', 'title')
      .populate('departmentRef', 'name')
      .sort({ updatedAt: -1 })
      .lean() as unknown as ChatGroupDocument[];
  }

  async create(dto: CreateGroupDto, creatorId: string): Promise<ChatGroupDocument> {
    const memberIds = [...new Set([creatorId, ...dto.memberIds])];
    const group = await this.groupModel.create({
      name: dto.name,
      type: 'custom' as ChatGroupType,
      channel: `group:${new Types.ObjectId().toHexString()}`,
      members: memberIds.map((id) => new Types.ObjectId(id)),
      isAutoCreated: false,
      createdBy: new Types.ObjectId(creatorId),
    });
    return group;
  }

  async findOrCreateDM(userId1: string, userId2: string): Promise<ChatGroupDocument> {
    // Canonical DM channel — sort IDs so order doesn't matter
    const [a, b] = [userId1, userId2].sort();
    const channel = `dm:${a}_${b}`;

    const existing = await this.groupModel.findOne({ channel }).populate('members', 'name email');
    if (existing) return existing as unknown as ChatGroupDocument;

    return this.groupModel.create({
      name: `DM`,
      type: 'individual' as ChatGroupType,
      channel,
      members: [new Types.ObjectId(userId1), new Types.ObjectId(userId2)],
      isAutoCreated: true,
      createdBy: new Types.ObjectId(userId1),
    }) as unknown as ChatGroupDocument;
  }

  async autoCreateForProject(
    projectId: string,
    projectTitle: string,
    memberIds: string[],
    creatorId: string,
  ): Promise<ChatGroupDocument> {
    const channel = `project:${projectId}`;
    const existing = await this.groupModel.findOne({ channel });
    if (existing) {
      // Update members if project team changed
      await this.groupModel.findByIdAndUpdate(existing._id, {
        members: memberIds.map((id) => new Types.ObjectId(id)),
        name: projectTitle,
      });
      return existing as unknown as ChatGroupDocument;
    }

    return this.groupModel.create({
      name: projectTitle,
      type: 'project' as ChatGroupType,
      channel,
      projectRef: new Types.ObjectId(projectId),
      members: memberIds.map((id) => new Types.ObjectId(id)),
      isAutoCreated: true,
      createdBy: new Types.ObjectId(creatorId),
    }) as unknown as ChatGroupDocument;
  }

  async autoCreateForDepartment(
    deptId: string,
    deptName: string,
  ): Promise<ChatGroupDocument> {
    const channel = `dept:${deptId}`;
    const existing = await this.groupModel.findOne({ channel });
    if (existing) return existing as unknown as ChatGroupDocument;

    return this.groupModel.create({
      name: deptName,
      type: 'department' as ChatGroupType,
      channel,
      departmentRef: new Types.ObjectId(deptId),
      members: [],
      isAutoCreated: true,
    }) as unknown as ChatGroupDocument;
  }

  async addMember(groupId: string, userId: string, actorId: string): Promise<ChatGroupDocument> {
    const group = await this.groupModel.findById(groupId);
    if (!group) throw new NotFoundException('chat_group.not_found');
    if (group.type !== 'custom' && !group.members.some((m) => String(m) === actorId)) {
      throw new ForbiddenException('chat_group.not_member');
    }
    await this.groupModel.findByIdAndUpdate(groupId, {
      $addToSet: { members: new Types.ObjectId(userId) },
    });
    return this.groupModel
      .findById(groupId)
      .populate('members', 'name email')
      .lean() as unknown as ChatGroupDocument;
  }

  async removeMember(groupId: string, userId: string, actorId: string): Promise<void> {
    const group = await this.groupModel.findById(groupId);
    if (!group) throw new NotFoundException('chat_group.not_found');
    if (group.type !== 'custom' && !group.members.some((m) => String(m) === actorId)) {
      throw new ForbiddenException('chat_group.not_member');
    }
    await this.groupModel.findByIdAndUpdate(groupId, {
      $pull: { members: new Types.ObjectId(userId) },
    });
  }

  async findByChannel(channel: string): Promise<ChatGroupDocument | null> {
    return this.groupModel
      .findOne({ channel, isActive: true })
      .populate('members', 'name email fcmToken')
      .lean() as unknown as ChatGroupDocument | null;
  }
}
