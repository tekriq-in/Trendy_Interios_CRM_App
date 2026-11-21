import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { DashboardService } from '../src/modules/dashboard/dashboard.service';

const mockProjectModel = { aggregate: jest.fn() };
const mockBlockerModel = {};
const mockApprovalModel = {};
const mockTaskModel = {};
const mockUserModel = {};
const mockPurchaseItemModel = {};
const mockHandoverModel = {};

describe('DashboardService date ranges', () => {
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

  it('uses an inclusive start date and an exclusive day-after end date', async () => {
    mockProjectModel.aggregate.mockResolvedValue([]);

    await service.getStageDurations({ from: '2026-11-01', to: '2026-11-12' });

    expect(mockProjectModel.aggregate).toHaveBeenCalledWith(
      expect.arrayContaining([
        {
          $match: {
            'stageHistory.completedAt': {
              $gte: new Date('2026-11-01T00:00:00.000Z'),
              $lt: new Date('2026-11-13T00:00:00.000Z'),
            },
          },
        },
      ]),
    );
  });

  it('rejects invalid calendar dates', async () => {
    await expect(
      service.getStageDurations({ from: '2026-02-30', to: '2026-03-01' }),
    ).rejects.toThrow('dashboard.invalid_from_date');
    expect(mockProjectModel.aggregate).not.toHaveBeenCalled();
  });

  it('rejects a start date later than the end date', async () => {
    await expect(
      service.getStageDurations({ from: '2026-11-13', to: '2026-11-12' }),
    ).rejects.toThrow('dashboard.invalid_date_range');
    expect(mockProjectModel.aggregate).not.toHaveBeenCalled();
  });
});
