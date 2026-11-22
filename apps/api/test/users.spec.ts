import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { UsersService } from '../src/modules/users/users.service';
import { ActivityLogService } from '../src/modules/activity-log/activity-log.service';
import { ChatGroupsService } from '../src/modules/chat-groups/chat-groups.service';

const mockUserModel = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
};

const mockActivityLog = {
  record: jest.fn(),
};

const mockChatGroups = {};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getModelToken('User'), useValue: mockUserModel },
        { provide: ActivityLogService, useValue: mockActivityLog },
        { provide: ChatGroupsService, useValue: mockChatGroups },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  const createDto = {
    name: 'Test Employee',
    email: 'employee@example.com',
    phone: '9090909091',
    password: 'Password123',
    roleId: '66acb0000000000000000001',
  };
  const actorId = '66acb0000000000000000002';

  it('returns a clear conflict when the phone number is already registered', async () => {
    mockUserModel.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ _id: 'existing-user' });

    await expect(service.create(createDto, actorId)).rejects.toThrow(
      'Phone number already exists.',
    );
    expect(mockUserModel.create).not.toHaveBeenCalled();
  });

  it('translates a duplicate phone index error into a clear conflict', async () => {
    mockUserModel.findOne.mockResolvedValue(null);
    mockUserModel.create.mockRejectedValue({
      code: 11000,
      keyPattern: { phone: 1 },
    });

    await expect(service.create(createDto, actorId)).rejects.toThrow(
      'Phone number already exists.',
    );
  });

  it('returns only the logged-in employee with dashboard-safe fields', async () => {
    const employeeId = '66acb0000000000000000003';
    const activeEmployees = [{ _id: employeeId, name: 'Active Employee', department: 'dept-id', isActive: true }];
    const select = jest.fn().mockReturnThis();
    mockUserModel.find.mockReturnValue({
      select,
      lean: jest.fn().mockResolvedValue(activeEmployees),
    });

    await expect(
      service.findForDashboard({ _id: employeeId, rolePermissions: [] }),
    ).resolves.toEqual(activeEmployees);

    const [filter] = mockUserModel.find.mock.calls[0];
    expect(filter.isActive).toBe(true);
    expect(String(filter._id)).toBe(employeeId);
    expect(select).toHaveBeenCalledWith('_id name department isActive');
  });
});
