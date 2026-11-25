import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { UsersService } from '../src/modules/users/users.service';
import { ActivityLogService } from '../src/modules/activity-log/activity-log.service';
import { ChatGroupsService } from '../src/modules/chat-groups/chat-groups.service';

const mockHelloCommand = jest.fn();
const mockStartSession = jest.fn();
const auditCollection = {
  collectionName: 'activitylogs',
  updateMany: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
};
const otherCollection = {
  collectionName: 'clients',
  updateMany: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
};

const createMockModel = () => ({
  db: {
    startSession: jest.fn(),
    db: { admin: () => ({ command: mockHelloCommand }) },
    collections: {
      activitylogs: auditCollection,
      clients: otherCollection,
    },
  },
  find: jest.fn(),
  findById: jest.fn(),
  countDocuments: jest.fn(),
  deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
  deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
  updateMany: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
});

const models = {
  User: createMockModel(),
  Role: createMockModel(),
  Project: createMockModel(),
  Task: createMockModel(),
  TIDocument: createMockModel(),
  Handover: createMockModel(),
  Blocker: createMockModel(),
  Approval: createMockModel(),
  PurchaseItem: createMockModel(),
  ShadeCardEntry: createMockModel(),
  ChatGroup: createMockModel(),
  Message: createMockModel(),
  SlaSettings: createMockModel(),
};

const mockActivityLog = { record: jest.fn() };

function makeQuery<T>(result: T) {
  return {
    select: jest.fn().mockReturnThis(),
    session: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(result),
  };
}

describe('UsersService permanent deletion', () => {
  let service: UsersService;
  const mockSession = {
    withTransaction: jest.fn(async (callback: () => Promise<void>) => callback()),
    endSession: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    Object.values(models).forEach((model) => {
      Object.values(model).forEach((value) => {
        if (jest.isMockFunction(value)) value.mockReset();
      });
      model.countDocuments.mockResolvedValue(0);
      model.deleteMany.mockResolvedValue({ deletedCount: 0 });
      model.deleteOne.mockResolvedValue({ deletedCount: 1 });
      model.updateMany.mockResolvedValue({ modifiedCount: 0 });
    });
    mockHelloCommand.mockReset().mockResolvedValue({});
    mockStartSession.mockReset().mockResolvedValue(mockSession);
    models.User.db.startSession = mockStartSession;
    mockSession.withTransaction.mockClear().mockImplementation(async (callback) => callback());
    mockSession.endSession.mockReset().mockResolvedValue(undefined);
    mockActivityLog.record.mockReset();
    auditCollection.updateMany.mockClear();
    otherCollection.updateMany.mockClear();

    const modelProviders = Object.entries(models).map(([name, model]) => ({
      provide: getModelToken(name),
      useValue: model,
    }));
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        ...modelProviders,
        { provide: ActivityLogService, useValue: mockActivityLog },
        { provide: ChatGroupsService, useValue: {} },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('purges employee-linked records and chats while retaining append-only audit history', async () => {
    const userId = new Types.ObjectId();
    const roleId = new Types.ObjectId();
    const documentId = new Types.ObjectId();
    const dmGroupId = new Types.ObjectId();
    const otherUserId = new Types.ObjectId();
    models.User.findById.mockReturnValue(makeQuery({ role: roleId }));
    models.Role.findById.mockReturnValue(makeQuery({ name: 'Employee' }));
    models.TIDocument.find.mockReturnValue(makeQuery([{ _id: documentId }]));
    models.ChatGroup.find.mockReturnValue(
      makeQuery([
        { _id: new Types.ObjectId(), channel: 'dept:department-id', type: 'department' },
        { _id: dmGroupId, channel: `dm:${userId.toString()}_${otherUserId.toString()}`, type: 'individual' },
      ]),
    );

    await expect(
      service.deletePermanently(userId.toString(), new Types.ObjectId().toString()),
    ).resolves.toEqual({ success: true });

    expect(models.Task.deleteMany).toHaveBeenCalledWith(
      { $or: [{ assignedTo: userId }, { createdBy: userId }] },
      {},
    );
    expect(models.TIDocument.deleteMany).toHaveBeenCalledWith(
      { _id: { $in: [documentId] } },
      {},
    );
    expect(models.Handover.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        $or: expect.arrayContaining([
          { raisedBy: userId },
          { proofFiles: { $in: [documentId] } },
        ]),
      }),
      {},
    );
    expect(models.Message.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        $or: expect.arrayContaining([
          { sender: userId },
          { channel: { $in: [`dm:${userId.toString()}_${otherUserId.toString()}`] } },
        ]),
      }),
      {},
    );
    expect(models.ChatGroup.deleteMany).toHaveBeenCalledWith(
      { _id: { $in: [dmGroupId] } },
      {},
    );
    expect(models.ChatGroup.updateMany).toHaveBeenCalledWith(
      { members: userId },
      { $pull: { members: userId } },
      {},
    );
    expect(models.Project.updateMany).toHaveBeenCalledWith(
      { assignedTeam: userId },
      { $pull: { assignedTeam: userId } },
      {},
    );
    expect(models.User.deleteOne).toHaveBeenCalledWith({ _id: userId }, {});
    expect(otherCollection.updateMany).toHaveBeenCalledWith(
      { createdBy: userId },
      { $unset: { createdBy: '' } },
      {},
    );
    expect(auditCollection.updateMany).not.toHaveBeenCalled();
    expect(mockSession.withTransaction).not.toHaveBeenCalled();
    expect(mockSession.endSession).toHaveBeenCalled();
  });

  it('prevents deleting MD accounts', async () => {
    const userId = new Types.ObjectId();
    const roleId = new Types.ObjectId();
    models.User.findById.mockReturnValue(makeQuery({ role: roleId }));
    models.Role.findById.mockReturnValue(makeQuery({ name: 'MD' }));
    mockHelloCommand.mockResolvedValue({ setName: 'rs0' });

    await expect(
      service.deletePermanently(userId.toString(), new Types.ObjectId().toString()),
    ).rejects.toThrow('user.cannot_delete_admin');

    expect(models.User.deleteOne).not.toHaveBeenCalled();
    expect(mockSession.withTransaction).toHaveBeenCalled();
    expect(mockSession.endSession).toHaveBeenCalled();
  });

  it('prevents administrators from deleting their own account', async () => {
    const userId = new Types.ObjectId().toString();

    await expect(service.deletePermanently(userId, userId)).rejects.toThrow(
      'user.cannot_delete_self',
    );
    expect(mockStartSession).not.toHaveBeenCalled();
  });

  it('bulk-deletes all non-MD accounts, including GM, while excluding the acting user', async () => {
    const mdRoleId = new Types.ObjectId();
    const gmRoleId = new Types.ObjectId();
    const employeeRoleId = new Types.ObjectId();
    const mdUserId = new Types.ObjectId();
    const gmUserId = new Types.ObjectId();
    const departmentHeadId = new Types.ObjectId();
    const employeeId = new Types.ObjectId();
    const actorId = new Types.ObjectId();
    models.Message.countDocuments.mockResolvedValue(17);
    models.ChatGroup.countDocuments.mockResolvedValue(8);

    models.Role.find.mockReturnValue(
      makeQuery([
        { _id: mdRoleId, name: 'MD' },
        { _id: gmRoleId, name: 'GM' },
        { _id: employeeRoleId, name: 'Employee' },
      ]),
    );
    models.User.find.mockReturnValue(
      makeQuery([{ _id: gmUserId }, { _id: departmentHeadId }, { _id: employeeId }]),
    );
    models.User.findById.mockImplementation((id: Types.ObjectId) =>
      makeQuery({ role: id.equals(gmUserId) ? gmRoleId : employeeRoleId }),
    );
    models.Role.findById.mockImplementation((id: Types.ObjectId) =>
      makeQuery({ name: id.equals(gmRoleId) ? 'GM' : 'Employee' }),
    );
    models.TIDocument.find.mockReturnValue(makeQuery([]));
    models.ChatGroup.find.mockReturnValue(makeQuery([]));

    await expect(service.deleteAllPermanently('DELETE ALL', actorId.toString())).resolves.toEqual({
      success: true,
      deletedCount: 3,
    });

    expect(mockActivityLog.record).toHaveBeenCalledWith(expect.objectContaining({
      actor: actorId.toString(),
      action: 'users.bulk_delete_requested',
      metadata: {
        deletedUsers: 3,
        deletedChatGroups: 8,
        deletedMessages: 17,
      },
    }));
    expect(mockActivityLog.record.mock.invocationCallOrder[0])
      .toBeLessThan(models.Message.deleteMany.mock.invocationCallOrder[0]);
    const filter = models.User.find.mock.calls[0][0];
    expect(filter.role.$nin.map((id: Types.ObjectId) => id.toString())).toEqual([
      mdRoleId.toString(),
    ]);
    expect(filter._id.$ne.toString()).toBe(actorId.toString());
    expect(models.User.deleteOne).toHaveBeenCalledTimes(3);
    expect(models.User.deleteOne).toHaveBeenCalledWith(
      { _id: gmUserId },
      {},
    );
    expect(models.User.deleteOne).toHaveBeenCalledWith(
      { _id: departmentHeadId },
      {},
    );
    expect(models.User.deleteOne).toHaveBeenCalledWith(
      { _id: employeeId },
      {},
    );
    expect(models.User.deleteOne).not.toHaveBeenCalledWith(
      { _id: mdUserId },
      {},
    );
    expect(models.Message.deleteMany).toHaveBeenNthCalledWith(1, {});
    expect(models.ChatGroup.deleteMany).toHaveBeenCalledWith({});
  });

  it('requires the exact bulk-delete confirmation before database access', async () => {
    await expect(
      service.deleteAllPermanently('delete all', new Types.ObjectId().toString()),
    ).rejects.toThrow('bulk_delete.confirmation_required');

    expect(models.Role.find).not.toHaveBeenCalled();
    expect(mockActivityLog.record).not.toHaveBeenCalled();
    expect(models.Message.deleteMany).not.toHaveBeenCalled();
  });
});
