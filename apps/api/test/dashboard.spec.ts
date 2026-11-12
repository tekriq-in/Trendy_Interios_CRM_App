import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { DashboardService } from '../src/modules/dashboard/dashboard.service';

const mockProjectModel = { find: jest.fn() };
const mockBlockerModel = { find: jest.fn() };
const mockApprovalModel = { find: jest.fn() };
const mockTaskModel = { aggregate: jest.fn(), find: jest.fn() };
const mockUserModel = { find: jest.fn() };
const mockPurchaseItemModel = { find: jest.fn() };
const mockHandoverModel = { find: jest.fn() };

describe('DashboardService', () => {
  let service: DashboardService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: getModelToken('Project'), useValue: mockProjectModel },
        { provide: getModelToken('Blocker'), useValue: mockBlockerModel },
        { provide: getModelToken('Approval'), useValue: mockApprovalModel },
        { provide: getModelToken('Task'), useValue: mockTaskModel },
        { provide: getModelToken('User'), useValue: mockUserModel },
        { provide: getModelToken('PurchaseItem'), useValue: mockPurchaseItemModel },
        { provide: getModelToken('Handover'), useValue: mockHandoverModel },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    jest.clearAllMocks();
  });

  it('includes all active employees, including employees with no open tasks', async () => {
    mockTaskModel.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([
        { userId: 'user-with-tasks', userName: 'Employee with tasks', totalTasks: 2, inProgress: 1 },
      ]),
    });
    mockUserModel.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([
        { _id: 'user-with-tasks', name: 'Employee with tasks' },
        { _id: 'user-without-tasks', name: 'Employee without tasks' },
      ]),
    });

    const result = await service.getWorkload();

    expect(result).toEqual([
      { userId: 'user-with-tasks', userName: 'Employee with tasks', totalTasks: 2, inProgress: 1 },
      { userId: 'user-without-tasks', userName: 'Employee without tasks', totalTasks: 0, inProgress: 0 },
    ]);
    expect(mockUserModel.find).toHaveBeenCalledWith({ isActive: true });
  });

  it('rejects invalid date ranges instead of silently returning misleading analytics', async () => {
    await expect(service.getBoard({ from: '2026-02-30', to: '2026-03-01' })).rejects.toThrow(
      'dashboard.invalid_from_date',
    );
  });

  it('includes projects with task activity in the selected date range', async () => {
    const projectId = '507f1f77bcf86cd799439011';
    const activityQuery = {
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    };
    const boardQuery = {
      populate: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([
        {
          _id: projectId,
          title: 'Active project',
          currentStage: { name: 'Design' },
        },
      ]),
    };
    mockProjectModel.find
      .mockReturnValueOnce(activityQuery)
      .mockReturnValueOnce(boardQuery);
    mockTaskModel.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([{ project: projectId }]),
    });
    for (const model of [
      mockApprovalModel,
      mockBlockerModel,
      mockPurchaseItemModel,
      mockHandoverModel,
    ]) {
      model.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });
    }

    const result = await service.getBoard({ from: '2026-11-01', to: '2026-11-12' });

    expect(mockTaskModel.find).toHaveBeenCalledWith({
      $or: [
        { createdAt: { $gte: new Date('2026-11-01T00:00:00.000Z'), $lt: new Date('2026-11-13T00:00:00.000Z') } },
        { updatedAt: { $gte: new Date('2026-11-01T00:00:00.000Z'), $lt: new Date('2026-11-13T00:00:00.000Z') } },
        { completedAt: { $gte: new Date('2026-11-01T00:00:00.000Z'), $lt: new Date('2026-11-13T00:00:00.000Z') } },
      ],
    });
    expect(mockProjectModel.find).toHaveBeenLastCalledWith({
      status: 'active',
      _id: { $in: [projectId] },
    });
    expect(result.Design).toHaveLength(1);
  });
});
