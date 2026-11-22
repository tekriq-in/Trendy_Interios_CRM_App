import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { ClientsService } from '../src/modules/clients/clients.service';
import { ActivityLogService } from '../src/modules/activity-log/activity-log.service';

const mockHelloCommand = jest.fn();

const createMockModel = () => ({
  db: {
    startSession: jest.fn(),
    db: { admin: () => ({ command: mockHelloCommand }) },
  },
  find: jest.fn(),
  deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
  updateMany: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
});

const models = {
  Client: createMockModel(),
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
  ClientMessage: createMockModel(),
  User: createMockModel(),
};

const mockActivityLog = { record: jest.fn() };
const mockSession = {
  withTransaction: jest.fn(async (callback: () => Promise<void>) => callback()),
  endSession: jest.fn().mockResolvedValue(undefined),
};
const mockStartSession = jest.fn().mockResolvedValue(mockSession);

function makeQuery<T>(result: T) {
  return {
    select: jest.fn().mockReturnThis(),
    session: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(result),
  };
}

describe('ClientsService permanent deletion', () => {
  let service: ClientsService;

  beforeEach(async () => {
    Object.values(models).forEach((model) => {
      Object.values(model).forEach((method) => {
        if (jest.isMockFunction(method)) method.mockReset();
      });
      model.deleteMany.mockResolvedValue({ deletedCount: 0 });
      model.updateMany.mockResolvedValue({ modifiedCount: 0 });
    });
    mockActivityLog.record.mockReset();
    mockHelloCommand.mockReset().mockResolvedValue({ setName: 'rs0' });
    mockSession.withTransaction.mockClear().mockImplementation(async (callback) => callback());
    mockSession.endSession.mockReset().mockResolvedValue(undefined);
    mockStartSession.mockReset().mockResolvedValue(mockSession);
    models.Client.db.startSession = mockStartSession;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientsService,
        ...Object.entries(models).map(([name, model]) => ({
          provide: getModelToken(name),
          useValue: model,
        })),
        { provide: ActivityLogService, useValue: mockActivityLog },
      ],
    }).compile();

    service = module.get<ClientsService>(ClientsService);
  });

  it('deletes client project records and clears user project assignments in one transaction', async () => {
    const clientId = new Types.ObjectId();
    const projectId = new Types.ObjectId();
    models.Client.find.mockReturnValue(makeQuery([{ _id: clientId }]));
    models.Project.find.mockReturnValue(makeQuery([{ _id: projectId }]));
    models.ChatGroup.find.mockReturnValue(
      makeQuery([{ channel: `custom-project:${projectId.toString()}` }]),
    );

    await expect(service.deletePermanently(clientId.toString())).resolves.toEqual({
      success: true,
      deletedClients: 1,
      deletedProjects: 1,
    });

    expect(models.Task.deleteMany).toHaveBeenCalledWith(
      { project: { $in: [projectId] } },
      { session: mockSession },
    );
    expect(models.TIDocument.deleteMany).toHaveBeenCalledWith(
      { project: { $in: [projectId] } },
      { session: mockSession },
    );
    expect(models.Handover.deleteMany).toHaveBeenCalledWith(
      { project: { $in: [projectId] } },
      { session: mockSession },
    );
    expect(models.Blocker.deleteMany).toHaveBeenCalledWith(
      { project: { $in: [projectId] } },
      { session: mockSession },
    );
    expect(models.Approval.deleteMany).toHaveBeenCalledWith(
      { project: { $in: [projectId] } },
      { session: mockSession },
    );
    expect(models.PurchaseItem.deleteMany).toHaveBeenCalledWith(
      { project: { $in: [projectId] } },
      { session: mockSession },
    );
    expect(models.ShadeCardEntry.deleteMany).toHaveBeenCalledWith(
      { project: { $in: [projectId] } },
      { session: mockSession },
    );
    expect(models.ChatGroup.deleteMany).toHaveBeenCalledWith(
      { projectRef: { $in: [projectId] } },
      { session: mockSession },
    );
    expect(models.Message.deleteMany).toHaveBeenCalledWith(
      { channel: { $in: [`project:${projectId.toString()}`, `custom-project:${projectId.toString()}`] } },
      { session: mockSession },
    );
    expect(models.ClientMessage.deleteMany).toHaveBeenCalledWith(
      {
        $or: [
          { client: { $in: [clientId] } },
          { project: { $in: [projectId] } },
        ],
      },
      { session: mockSession },
    );
    expect(models.User.updateMany).toHaveBeenCalledWith(
      { assignedProjects: { $in: [projectId] } },
      { $pull: { assignedProjects: { $in: [projectId] } } },
      { session: mockSession },
    );
    expect(models.Project.deleteMany).toHaveBeenCalledWith(
      { _id: { $in: [projectId] } },
      { session: mockSession },
    );
    expect(models.Client.deleteMany).toHaveBeenCalledWith(
      { _id: { $in: [clientId] } },
      { session: mockSession },
    );
    expect(mockSession.endSession).toHaveBeenCalled();
  });

  it('does not delete data when the client does not exist', async () => {
    const clientId = new Types.ObjectId();
    models.Client.find.mockReturnValue(makeQuery([]));

    await expect(service.deletePermanently(clientId.toString())).rejects.toThrow('client.not_found');
    expect(models.Project.deleteMany).not.toHaveBeenCalled();
    expect(models.Client.deleteMany).not.toHaveBeenCalled();
    expect(mockSession.endSession).toHaveBeenCalled();
  });

  it('permanently deletes every client, including clients with no projects', async () => {
    const clientIds = [new Types.ObjectId(), new Types.ObjectId()];
    const projectId = new Types.ObjectId();
    models.Client.find.mockReturnValue(makeQuery(clientIds.map((_id) => ({ _id }))));
    models.Project.find.mockReturnValue(makeQuery([{ _id: projectId }]));
    models.ChatGroup.find.mockReturnValue(makeQuery([]));

    await expect(service.deleteAllPermanently()).resolves.toEqual({
      success: true,
      deletedClients: 2,
      deletedProjects: 1,
    });

    expect(models.Project.find).toHaveBeenCalledWith({ client: { $in: clientIds } });
    expect(models.ClientMessage.deleteMany).toHaveBeenCalledWith(
      {
        $or: [
          { client: { $in: clientIds } },
          { project: { $in: [projectId] } },
        ],
      },
      { session: mockSession },
    );
    expect(models.Client.deleteMany).toHaveBeenCalledWith(
      { _id: { $in: clientIds } },
      { session: mockSession },
    );
  });

  it('deletes clients on standalone MongoDB without starting an unsupported transaction', async () => {
    const clientId = new Types.ObjectId();
    mockHelloCommand.mockResolvedValue({});
    models.Client.find.mockReturnValue(makeQuery([{ _id: clientId }]));
    models.Project.find.mockReturnValue(makeQuery([]));

    await expect(service.deleteAllPermanently()).resolves.toEqual({
      success: true,
      deletedClients: 1,
      deletedProjects: 0,
    });

    expect(mockSession.withTransaction).not.toHaveBeenCalled();
    expect(models.Client.deleteMany).toHaveBeenCalledWith(
      { _id: { $in: [clientId] } },
      {},
    );
    expect(models.ClientMessage.deleteMany).toHaveBeenCalledWith(
      { $or: [{ client: { $in: [clientId] } }] },
      {},
    );
  });
});
