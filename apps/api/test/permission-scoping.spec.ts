import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ProjectsService } from '../src/modules/projects/projects.service';
import { ActivityLogService } from '../src/modules/activity-log/activity-log.service';
import { PERMISSIONS } from '@ti/shared';

const mockProject = {
  _id: new Types.ObjectId(),
  title: 'Test Project',
  assignedTeam: [new Types.ObjectId()], // different user
};

const mockProjectModel = {
  find: jest.fn(),
  findOne: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  db: { model: jest.fn() },
};

const mockActivityLog = { record: jest.fn() };
const mockEventEmitter = { emit: jest.fn() };

describe('Permission Scoping — Employee project isolation', () => {
  let service: ProjectsService;
  const employeeId = new Types.ObjectId().toHexString();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: getModelToken('Project'), useValue: mockProjectModel },
        { provide: ActivityLogService, useValue: mockActivityLog },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
    jest.clearAllMocks();
  });

  it('returns only assigned projects for Employee (no read_all permission)', async () => {
    const assignedProject = { ...mockProject, assignedTeam: [new Types.ObjectId(employeeId)] };

    mockProjectModel.find.mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([assignedProject]),
    });

    const user = {
      _id: employeeId,
      rolePermissions: [PERMISSIONS.PROJECTS_READ_OWN],
    };

    const result = await service.findAll(user);

    const callArg = mockProjectModel.find.mock.calls[0][0];
    expect(callArg).toMatchObject({
      assignedTeam: expect.any(Types.ObjectId),
    });
    expect(callArg.assignedTeam.toHexString()).toBe(employeeId);
    expect(result).toHaveLength(1);
  });

  it('returns all projects for MD (has read_all permission)', async () => {
    mockProjectModel.find.mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([mockProject, { ...mockProject, _id: new Types.ObjectId() }]),
    });

    const mdUser = {
      _id: new Types.ObjectId().toHexString(),
      rolePermissions: [PERMISSIONS.PROJECTS_READ_ALL, PERMISSIONS.PROJECTS_READ_OWN],
    };

    const result = await service.findAll(mdUser);

    const callArg = mockProjectModel.find.mock.calls[0][0];
    expect(callArg).toEqual({});
    expect(result).toHaveLength(2);
  });

  it('findById throws 404 for Employee accessing unassigned project', async () => {
    mockProjectModel.findOne.mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(null),
    });

    const user = {
      _id: employeeId,
      rolePermissions: [PERMISSIONS.PROJECTS_READ_OWN],
    };

    const projectId = new Types.ObjectId().toHexString();
    await expect(service.findById(projectId, user)).rejects.toThrow('project.not_found');
  });
});
