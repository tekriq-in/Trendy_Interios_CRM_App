import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ChatGroup, ChatGroupDocument, ChatGroupType } from './chat-group.schema';
import { Message } from '../messages/messages.schema';

export interface CreateGroupDto {
  name: string;
  memberIds: string[];
}

@Injectable()
export class ChatGroupsService {
  constructor(
    @InjectModel(ChatGroup.name) private groupModel: Model<ChatGroupDocument>,
    @InjectModel(Message.name) private messageModel: Model<Message & { _id: unknown }>,
  ) {}

  async findForUser(userId: string): Promise<(ChatGroupDocument & { lastMessage?: { body: string; senderName: string; createdAt: string } | null })[]> {
    // Department groups are common channels — return all of them regardless of membership.
    // For all other types (project, individual, custom) return only groups the user belongs to.
    const groups = await this.groupModel.aggregate([
      {
        $match: {
          isActive: true,
          $or: [
            { members: new Types.ObjectId(userId) },
            { type: 'department' },
          ],
        },
      },
      { $sort: { updatedAt: -1 } },
      {
        $lookup: {
          from: 'users',
          let: { mids: '$members' },
          pipeline: [
            { $match: { $expr: { $in: ['$_id', '$$mids'] } } },
            { $project: { _id: 1, name: 1, email: 1 } },
          ],
          as: 'members',
        },
      },
      {
        $lookup: {
          from: 'projects',
          let: { pid: '$projectRef' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$pid'] } } },
            { $project: { _id: 1, title: 1 } },
          ],
          as: 'projectRefArr',
        },
      },
      {
        $lookup: {
          from: 'departments',
          let: { did: '$departmentRef' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$did'] } } },
            { $project: { _id: 1, name: 1 } },
          ],
          as: 'departmentRefArr',
        },
      },
      {
        $addFields: {
          projectRef: { $arrayElemAt: ['$projectRefArr', 0] },
          departmentRef: { $arrayElemAt: ['$departmentRefArr', 0] },
        },
      },
      { $unset: ['projectRefArr', 'departmentRefArr'] },
    ]) as unknown as ChatGroupDocument[];

    // Attach the most recent message per group in one bulk query
    const channels = groups.map((g) => g.channel);
    const lastMessages = await (this.messageModel as unknown as Model<{ channel: string; body: string; sender: Types.ObjectId; createdAt: Date }>)
      .aggregate([
        { $match: { channel: { $in: channels } } },
        { $sort: { createdAt: -1 } },
        { $group: { _id: '$channel', body: { $first: '$body' }, sender: { $first: '$sender' }, senderId: { $first: { $toString: '$sender' } }, createdAt: { $first: '$createdAt' } } },
        // Pipeline lookup handles both ObjectId and string sender values
        {
          $lookup: {
            from: 'users',
            let: { sid: '$sender' },
            pipeline: [
              { $match: { $expr: { $eq: ['$_id', '$$sid'] } } },
              { $project: { name: 1, _id: 0 } },
            ],
            as: 'senderUser',
          },
        },
        {
          $project: {
            _id: 1,
            body: 1,
            createdAt: 1,
            senderId: 1,
            senderName: {
              $ifNull: [{ $arrayElemAt: ['$senderUser.name', 0] }, { $ifNull: ['$senderId', 'Unknown'] }],
            },
          },
        },
      ]);

    const lastMsgMap = new Map(lastMessages.map((m: { _id: string; body: string; senderName: string; senderId: string; createdAt: Date }) => [
      m._id,
      {
        body: m.body,
        senderName: m.senderId === userId ? 'You' : (m.senderName || 'Unknown'),
        createdAt: m.createdAt?.toISOString?.() ?? String(m.createdAt),
      },
    ]));

    return groups.map((g) => {
      let displayName: string | undefined;
      if (g.type === 'individual') {
        const members = g.members as unknown as Array<{ _id: unknown; name?: string }>;
        const other = members.find((m) => String(m._id) !== userId);
        displayName = other?.name ?? members[0]?.name;
      }
      return Object.assign(g, {
        lastMessage: lastMsgMap.get(g.channel) ?? null,
        ...(displayName ? { displayName } : {}),
      });
    });
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

    const created = await this.groupModel.create({
      name: `DM`,
      type: 'individual' as ChatGroupType,
      channel,
      members: [new Types.ObjectId(userId1), new Types.ObjectId(userId2)],
      isAutoCreated: true,
      createdBy: new Types.ObjectId(userId1),
    });
    await created.populate('members', 'name email');
    return created as unknown as ChatGroupDocument;
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
    // Department groups: anyone can add themselves (self-join). Others: must already be a member.
    const isSelfJoin = userId === actorId;
    if (!isSelfJoin && group.type !== 'custom' && !group.members.some((m) => String(m) === actorId)) {
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
    // Members can remove themselves from any group type (self-leave).
    // Removing others requires being a member of a custom group.
    const isSelfLeave = userId === actorId;
    if (!isSelfLeave && group.type !== 'custom' && !group.members.some((m) => String(m) === actorId)) {
      throw new ForbiddenException('chat_group.not_member');
    }
    await this.groupModel.findByIdAndUpdate(groupId, {
      $pull: { members: new Types.ObjectId(userId) },
    });
  }

  async joinGroup(groupId: string, userId: string): Promise<ChatGroupDocument> {
    return this.addMember(groupId, userId, userId);
  }

  async leaveGroup(groupId: string, userId: string): Promise<void> {
    return this.removeMember(groupId, userId, userId);
  }

  async findById(id: string): Promise<ChatGroupDocument | null> {
    return this.groupModel
      .findById(id)
      .populate('members', 'name email')
      .populate('projectRef', 'title')
      .populate('departmentRef', 'name')
      .lean() as unknown as ChatGroupDocument | null;
  }

  async findByChannel(channel: string): Promise<ChatGroupDocument | null> {
    return this.groupModel
      .findOne({ channel, isActive: true })
      .populate('members', 'name email fcmToken')
      .lean() as unknown as ChatGroupDocument | null;
  }
}
