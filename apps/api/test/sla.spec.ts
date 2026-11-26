jest.mock('@nestjs/schedule', () => ({
  Cron: () => () => undefined,
}));

import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SlaService } from '../src/modules/sla/sla.service';
import { ActivityLogService } from '../src/modules/activity-log/activity-log.service';

const mockSlaModel = {
  find: jest.fn(),
};

const mockProjectModel = {
  find: jest.fn(),
};

describe('SlaService', () => {
  let service: SlaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SlaService,
        { provide: getModelToken('SlaSettings'), useValue: mockSlaModel },
        { provide: getModelToken('Project'), useValue: mockProjectModel },
        { provide: getModelToken('Blocker'), useValue: {} },
        { provide: getModelToken('Department'), useValue: {} },
        { provide: ActivityLogService, useValue: { record: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<SlaService>(SlaService);
    jest.clearAllMocks();
  });

  it('limits SLA report projects to those assigned to the employee', async () => {
    const employeeId = new Types.ObjectId();
    mockSlaModel.find.mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    });
    mockProjectModel.find.mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    });

    await service.getReport({ _id: String(employeeId), rolePermissions: [] });

    expect(mockProjectModel.find).toHaveBeenCalledWith({
      status: 'active',
      assignedTeam: employeeId,
    });
  });
});
