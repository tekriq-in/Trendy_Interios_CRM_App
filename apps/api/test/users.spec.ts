import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../src/modules/users/users.service';
import { ActivityLogService } from '../src/modules/activity-log/activity-log.service';
import { ChatGroupsService } from '../src/modules/chat-groups/chat-groups.service';

const mockUserModel = {
  findOne: jest.fn(),
  find: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  create: jest.fn(),
};

const mockActivityLog = {
  record: jest.fn(),
};

const mockChatGroups = {};
const deletionModelNames = [
  'Role',
  'Project',
  'Task',
  'TIDocument',
  'Handover',
  'Blocker',
  'Approval',
  'PurchaseItem',
  'ShadeCardEntry',
  'ChatGroup',
  'Message',
  'SlaSettings',
];

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getModelToken('User'), useValue: mockUserModel },
        ...deletionModelNames.map((name) => ({
          provide: getModelToken(name),
          useValue: {},
        })),
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

  it('stores reset passwords as hashes and requires a password change', async () => {
    mockUserModel.findByIdAndUpdate.mockResolvedValue({ _id: 'target-user' });

    const result = await service.resetPassword(
      'target-user',
      { password: 'StrongPass123', confirmPassword: 'StrongPass123' },
      actorId,
    );

    const [, update] = mockUserModel.findByIdAndUpdate.mock.calls[0];
    expect(update.mustChangePassword).toBe(true);
    expect(update.refreshTokens).toEqual([]);
    expect(update.passwordHash).not.toBe('StrongPass123');
    await expect(bcrypt.compare('StrongPass123', update.passwordHash)).resolves.toBe(true);
    expect(result).toEqual({ success: true });
    expect(mockActivityLog.record).toHaveBeenCalledWith(expect.objectContaining({
      action: 'user.password_reset',
    }));
  });

  it('rejects a reset when the entered password confirmation differs', async () => {
    await expect(service.resetPassword(
      'target-user',
      { password: 'StrongPass123', confirmPassword: 'DifferentPass123' },
      actorId,
    )).rejects.toThrow('Password confirmation does not match.');

    expect(mockUserModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });
});
