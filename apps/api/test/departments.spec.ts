import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { DepartmentsService } from '../src/modules/departments/departments.service';
import { ActivityLogService } from '../src/modules/activity-log/activity-log.service';
import { ChatGroupsService } from '../src/modules/chat-groups/chat-groups.service';

const mockDepartmentModel = {
  findByIdAndUpdate: jest.fn(),
};

const mockSlaModel = {
  updateOne: jest.fn(),
};

const mockActivityLog = {
  record: jest.fn(),
};

const mockChatGroups = {};

describe('DepartmentsService', () => {
  let service: DepartmentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepartmentsService,
        { provide: getModelToken('Department'), useValue: mockDepartmentModel },
        { provide: getModelToken('SlaSettings'), useValue: mockSlaModel },
        { provide: ActivityLogService, useValue: mockActivityLog },
        { provide: ChatGroupsService, useValue: mockChatGroups },
      ],
    }).compile();

    service = module.get<DepartmentsService>(DepartmentsService);
    jest.clearAllMocks();
  });

  it('updates the department SLA settings when its default SLA hours change', async () => {
    const id = '66acb0000000000000000001';
    const department = { _id: id, defaultSlaHours: 36 };
    mockDepartmentModel.findByIdAndUpdate.mockResolvedValue(department);
    mockSlaModel.updateOne.mockResolvedValue({ acknowledged: true });
    mockActivityLog.record.mockResolvedValue(undefined);

    await service.update(id, { defaultSlaHours: 36 }, '66acb000000000000000002');

    expect(mockSlaModel.updateOne).toHaveBeenCalledWith(
      { department: department._id },
      { $set: { defaultHours: 36 } },
      { upsert: true },
    );
  });
});
