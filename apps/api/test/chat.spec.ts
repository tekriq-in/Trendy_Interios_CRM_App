import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { ChatGroupsService } from '../src/modules/chat-groups/chat-groups.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

// ─── Mock factories ──────────────────────────────────────────────────────────

function makeGroup(overrides: Partial<{ _id: unknown; type: string; members: unknown[]; channel: string; isActive: boolean }> = {}) {
  return {
    _id: new Types.ObjectId(),
    name: 'Test Group',
    type: 'custom',
    channel: `group:${new Types.ObjectId().toHexString()}`,
    members: [],
    isAutoCreated: false,
    isActive: true,
    createdBy: new Types.ObjectId(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const mockGroupModel = {
  find: jest.fn(),
  findOne: jest.fn(),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  create: jest.fn(),
  aggregate: jest.fn(),
};

const mockMessageModel = {
  aggregate: jest.fn(),
};

const mockDepartmentModel = {
  findById: jest.fn(),
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ChatGroupsService', () => {
  let service: ChatGroupsService;
  const userId = new Types.ObjectId().toHexString();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatGroupsService,
        { provide: getModelToken('ChatGroup'), useValue: mockGroupModel },
        { provide: getModelToken('Message'), useValue: mockMessageModel },
        { provide: getModelToken('Department'), useValue: mockDepartmentModel },
      ],
    }).compile();

    service = module.get<ChatGroupsService>(ChatGroupsService);
    jest.clearAllMocks();
  });

  // ── findForUser ─────────────────────────────────────────────────────────────
  describe('findForUser', () => {
    it('returns groups the user is a member of, with lastMessage attached', async () => {
      const group = makeGroup({ channel: 'project:abc123', members: [new Types.ObjectId(userId)] });
      // findForUser uses aggregate on the group model (not find)
      mockGroupModel.aggregate.mockResolvedValue([group]);
      mockMessageModel.aggregate.mockResolvedValue([
        { _id: 'project:abc123', body: 'Hello', senderName: 'Alice', senderId: 'other', createdAt: new Date() },
      ]);

      const result = await service.findForUser(userId);
      expect(result).toHaveLength(1);
      expect(result[0].lastMessage).toBeDefined();
      expect(result[0].lastMessage!.body).toBe('Hello');
      expect(result[0].lastMessage!.senderName).toBe('Alice');
    });

    it('returns null lastMessage for groups with no messages', async () => {
      const group = makeGroup({ channel: 'group:empty' });
      mockGroupModel.aggregate.mockResolvedValue([group]);
      mockMessageModel.aggregate.mockResolvedValue([]);

      const result = await service.findForUser(userId);
      expect(result[0].lastMessage).toBeNull();
    });
  });

  // ── create ──────────────────────────────────────────────────────────────────
  describe('create', () => {
    it('always includes the creator as a member', async () => {
      const memberId = new Types.ObjectId().toHexString();
      const group = makeGroup();
      const populatedGroup = {
        ...group,
        populate: jest.fn().mockResolvedValue(group),
      };
      mockGroupModel.create.mockResolvedValue(populatedGroup);

      await service.create({ name: 'Team Alpha', memberIds: [memberId] }, userId);

      const call = mockGroupModel.create.mock.calls[0][0];
      const memberStrings = call.members.map(String);
      expect(memberStrings).toContain(userId);
      expect(memberStrings).toContain(memberId);
      expect(populatedGroup.populate).toHaveBeenCalledWith('members', 'name email');
    });

    it('deduplicates creator if already in memberIds', async () => {
      mockGroupModel.create.mockResolvedValue({
        ...makeGroup(),
        populate: jest.fn().mockResolvedValue(undefined),
      });
      await service.create({ name: 'Dupe Check', memberIds: [userId] }, userId);

      const call = mockGroupModel.create.mock.calls[0][0];
      const times = call.members.filter((m: Types.ObjectId) => String(m) === userId).length;
      expect(times).toBe(1);
    });
  });

  // ── findOrCreateDM ──────────────────────────────────────────────────────────
  describe('findOrCreateDM', () => {
    it('returns existing DM if one exists', async () => {
      const existingDM = makeGroup({ type: 'individual', channel: 'dm:aaa_bbb' });
      mockGroupModel.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(existingDM),
      });

      const result = await service.findOrCreateDM('aaa', 'bbb');
      expect(result.channel).toBe('dm:aaa_bbb');
      expect(mockGroupModel.create).not.toHaveBeenCalled();
    });

    it('creates a new DM with canonical channel key', async () => {
      const id1 = new Types.ObjectId().toHexString();
      const id2 = new Types.ObjectId().toHexString();
      const [sorted1, sorted2] = [id1, id2].sort();
      mockGroupModel.findOne.mockReturnValue({ populate: jest.fn().mockResolvedValue(null) });
      const dm = makeGroup({ type: 'individual', channel: `dm:${sorted1}_${sorted2}` });
      // Service calls created.populate() after create — add it to the mock
      mockGroupModel.create.mockResolvedValue({ ...dm, populate: jest.fn().mockResolvedValue(dm) });

      await service.findOrCreateDM(id2, id1); // order reversed intentionally
      const call = mockGroupModel.create.mock.calls[0][0];
      // Channel key must be sorted so it's the same regardless of argument order
      expect(call.channel).toBe(`dm:${sorted1}_${sorted2}`);
    });
  });

  // ── autoCreateForProject ────────────────────────────────────────────────────
  describe('autoCreateForProject', () => {
    it('does not create duplicate if group already exists', async () => {
      const existing = makeGroup({ channel: 'project:p1' });
      mockGroupModel.findOne.mockResolvedValue(existing);
      mockGroupModel.findByIdAndUpdate.mockResolvedValue(existing);

      await service.autoCreateForProject('p1', 'New Title', [userId], userId);
      expect(mockGroupModel.create).not.toHaveBeenCalled();
    });

    it('creates group for new project with correct channel', async () => {
      const projectId = new Types.ObjectId().toHexString();
      mockGroupModel.findOne.mockResolvedValue(null);
      const group = makeGroup({ channel: `project:${projectId}`, type: 'project' });
      mockGroupModel.create.mockResolvedValue(group);

      const result = await service.autoCreateForProject(projectId, 'Kitchen Reno', [userId], userId);
      const call = mockGroupModel.create.mock.calls[0][0];
      expect(call.channel).toBe(`project:${projectId}`);
      expect(call.type).toBe('project');
      expect(result).toBeDefined();
    });
  });

  // ── autoCreateForDepartment ─────────────────────────────────────────────────
  describe('autoCreateForDepartment', () => {
    it('creates department group on first call', async () => {
      const deptId = new Types.ObjectId().toHexString();
      mockGroupModel.findOne.mockResolvedValue(null);
      const group = makeGroup({ channel: `dept:${deptId}`, type: 'department' });
      mockGroupModel.create.mockResolvedValue(group);

      const result = await service.autoCreateForDepartment(deptId, 'Design');
      const call = mockGroupModel.create.mock.calls[0][0];
      expect(call.type).toBe('department');
      expect(call.channel).toBe(`dept:${deptId}`);
      expect(result).toBeDefined();
    });

    describe('addDepartmentMember', () => {
      it('adds an employee to the existing department group', async () => {
        const deptId = new Types.ObjectId().toHexString();
        const group = makeGroup({ channel: `dept:${deptId}`, type: 'department' });
        mockGroupModel.findOne.mockResolvedValue(group);
        mockGroupModel.findByIdAndUpdate.mockResolvedValue(group);

        await service.addDepartmentMember(deptId, userId);

        const [updatedGroupId, update] = mockGroupModel.findByIdAndUpdate.mock.calls[0];
        expect(String(updatedGroupId)).toBe(String(group._id));
        expect(String(update.$addToSet.members)).toBe(userId);
      });

      it('creates the department group if missing before adding the employee', async () => {
        const deptId = new Types.ObjectId().toHexString();
        const group = makeGroup({ channel: `dept:${deptId}`, type: 'department' });
        mockGroupModel.findOne.mockResolvedValue(null);
        mockDepartmentModel.findById.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          lean: jest.fn().mockResolvedValue({ name: 'Design' }),
        });
        mockGroupModel.create.mockResolvedValue(group);
        mockGroupModel.findByIdAndUpdate.mockResolvedValue(group);

        await service.addDepartmentMember(deptId, userId);

        expect(mockGroupModel.create).toHaveBeenCalledWith(expect.objectContaining({
          name: 'Design',
          type: 'department',
          channel: `dept:${deptId}`,
        }));
        expect(mockGroupModel.findByIdAndUpdate).toHaveBeenCalled();
      });
    });

    it('returns existing group without creating a duplicate', async () => {
      const deptId = new Types.ObjectId().toHexString();
      const existing = makeGroup({ channel: `dept:${deptId}`, type: 'department' });
      mockGroupModel.findOne.mockResolvedValue(existing);

      const result = await service.autoCreateForDepartment(deptId, 'Design');
      expect(mockGroupModel.create).not.toHaveBeenCalled();
      expect(result.channel).toBe(`dept:${deptId}`);
    });
  });

  // ── addMember ───────────────────────────────────────────────────────────────
  describe('addMember', () => {
    it('throws NotFoundException for unknown group', async () => {
      mockGroupModel.findById.mockResolvedValue(null);
      await expect(service.addMember(new Types.ObjectId().toHexString(), userId, userId)).rejects.toThrow(NotFoundException);
    });

    it('adds user to group', async () => {
      const group = makeGroup({ members: [new Types.ObjectId(userId)] });
      const chain = { populate: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue(group) };
      // First findById call (validation check) returns group directly
      // Second findById call (return populated group) returns chainable
      mockGroupModel.findById
        .mockResolvedValueOnce(group)
        .mockReturnValueOnce(chain);
      mockGroupModel.findByIdAndUpdate.mockResolvedValue(group);

      await service.addMember(String(group._id), userId, userId);
      expect(mockGroupModel.findByIdAndUpdate).toHaveBeenCalledWith(
        String(group._id),
        { $addToSet: { members: expect.any(Types.ObjectId) } },
      );
    });
  });

  // ── removeMember ─────────────────────────────────────────────────────────────
  describe('removeMember', () => {
    it('throws NotFoundException for unknown group', async () => {
      mockGroupModel.findById.mockResolvedValue(null);
      await expect(service.removeMember(new Types.ObjectId().toHexString(), userId, userId)).rejects.toThrow(NotFoundException);
    });

    it('removes user from group', async () => {
      const group = makeGroup({ members: [new Types.ObjectId(userId)] });
      mockGroupModel.findById.mockResolvedValue(group);
      mockGroupModel.findByIdAndUpdate.mockResolvedValue(group);

      await service.removeMember(String(group._id), userId, userId);
      expect(mockGroupModel.findByIdAndUpdate).toHaveBeenCalledWith(
        String(group._id),
        { $pull: { members: expect.any(Types.ObjectId) } },
      );
    });

    it('allows admins with user edit permission to remove department members', async () => {
      const targetId = new Types.ObjectId().toHexString();
      const actorId = new Types.ObjectId().toHexString();
      const group = makeGroup({ type: 'department', members: [new Types.ObjectId(targetId)] });
      mockGroupModel.findById.mockResolvedValue(group);
      mockGroupModel.findByIdAndUpdate.mockResolvedValue(group);

      await service.removeMember(
        String(group._id),
        targetId,
        actorId,
        ['users:edit'],
      );

      expect(mockGroupModel.findByIdAndUpdate).toHaveBeenCalledWith(
        String(group._id),
        { $pull: { members: new Types.ObjectId(targetId) } },
      );
    });

    it('prevents non-admins from removing other department members', async () => {
      const targetId = new Types.ObjectId().toHexString();
      const actorId = new Types.ObjectId().toHexString();
      const group = makeGroup({ type: 'department', members: [new Types.ObjectId(targetId)] });
      mockGroupModel.findById.mockResolvedValue(group);

      await expect(
        service.removeMember(String(group._id), targetId, actorId),
      ).rejects.toThrow(ForbiddenException);
      expect(mockGroupModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });
  });

  // ── findById ─────────────────────────────────────────────────────────────────
  describe('findById', () => {
    it('returns null for unknown id', async () => {
      mockGroupModel.findById.mockReturnValue({ populate: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue(null) });
      const result = await service.findById(new Types.ObjectId().toHexString());
      expect(result).toBeNull();
    });

    it('returns group with members populated', async () => {
      const group = makeGroup();
      mockGroupModel.findById.mockReturnValue({ populate: jest.fn().mockReturnThis(), lean: jest.fn().mockResolvedValue(group) });
      const result = await service.findById(String(group._id));
      expect(result).not.toBeNull();
      expect(result!.name).toBe('Test Group');
    });
  });
});
