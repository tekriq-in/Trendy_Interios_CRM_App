import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { BlockersService } from '../src/modules/blockers/blockers.service';
import { ActivityLogService } from '../src/modules/activity-log/activity-log.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PERMISSIONS } from '@ti/shared';

const mockBlockerModel = {
  find: jest.fn(),
};

const mockProjectModel = {
  find: jest.fn(),
};

describe('BlockersService', () => {
  let service: BlockersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlockersService,
        { provide: getModelToken('Blocker'), useValue: mockBlockerModel },
        { provide: getModelToken('Project'), useValue: mockProjectModel },
        { provide: ActivityLogService, useValue: { record: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<BlockersService>(BlockersService);
    jest.clearAllMocks();
  });

  it('limits employee blockers to their assigned projects', async () => {
    const userId = new Types.ObjectId().toHexString();
    const projectId = new Types.ObjectId();
    const blockerQuery = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    };
    mockProjectModel.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([{ _id: projectId }]),
    });
    mockBlockerModel.find.mockReturnValue(blockerQuery);

    await service.findAll({ _id: userId, rolePermissions: [] }, 'open');

    expect(mockProjectModel.find).toHaveBeenCalledWith({
      assignedTeam: new Types.ObjectId(userId),
    });
    expect(mockBlockerModel.find).toHaveBeenCalledWith({
      status: 'open',
      project: { $in: [projectId] },
    });
  });

  it('returns no blockers when an employee has no assigned projects', async () => {
    mockProjectModel.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    });

    const result = await service.findAll({ _id: new Types.ObjectId().toHexString(), rolePermissions: [] });

    expect(result).toEqual([]);
    expect(mockBlockerModel.find).not.toHaveBeenCalled();
  });

  it('keeps the full blocker list for users with read-all permission', async () => {
    const blockerQuery = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    };
    mockBlockerModel.find.mockReturnValue(blockerQuery);

    await service.findAll({
      _id: new Types.ObjectId().toHexString(),
      rolePermissions: [PERMISSIONS.PROJECTS_READ_ALL],
    });

    expect(mockProjectModel.find).not.toHaveBeenCalled();
    expect(mockBlockerModel.find).toHaveBeenCalledWith({});
  });
});
