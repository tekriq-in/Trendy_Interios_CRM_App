import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AuthService } from '../src/modules/auth/auth.service';
import { ActivityLogService } from '../src/modules/activity-log/activity-log.service';
import { ChangePasswordDto, ResetPasswordDto } from '../src/modules/users/dto/user.dto';

describe('AuthService password change', () => {
  let service: AuthService;
  const updatedUser = {
    _id: 'user-id',
    email: 'employee@example.com',
    name: 'Employee',
    role: { _id: 'role-id', name: 'Employee', permissions: [] },
    department: null,
    mustChangePassword: false,
  };
  const passwordHash = bcrypt.hashSync('Temporary123', 4);
  const savedPasswordUpdate = {
    populate: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(updatedUser),
  };
  const userModel = {
    findById: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: 'user-id',
          passwordHash,
          mustChangePassword: true,
        }),
      }),
    }),
    findByIdAndUpdate: jest.fn()
      .mockReturnValueOnce(savedPasswordUpdate)
      .mockResolvedValueOnce(undefined),
  };
  const jwtService = { sign: jest.fn().mockReturnValueOnce('access-token').mockReturnValueOnce('refresh-token') };
  const config = {
    get: jest.fn().mockReturnValue('15m'),
    getOrThrow: jest.fn().mockReturnValue('refresh-secret'),
  };
  const activityLog = { record: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getModelToken('User'), useValue: userModel },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: config },
        { provide: ActivityLogService, useValue: activityLog },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('Password DTO validation', () => {
    it('rejects weak manually entered reset passwords', async () => {
      const dto = plainToInstance(ResetPasswordDto, {
        password: 'weakpass',
        confirmPassword: 'weakpass',
      });

      const errors = await validate(dto);
      expect(errors.map((error) => error.property)).toContain('password');
    });

    it('requires an entered password and confirmation for a reset', async () => {
      const dto = plainToInstance(ResetPasswordDto, {});

      const errors = await validate(dto);
      expect(errors.map((error) => error.property)).toEqual(expect.arrayContaining(['password', 'confirmPassword']));
    });

    it('rejects a weak employee-selected new password', async () => {
      const dto = plainToInstance(ChangePasswordDto, {
        currentPassword: 'Temporary123',
        newPassword: 'weakpass',
        confirmPassword: 'weakpass',
      });

      const errors = await validate(dto);
      expect(errors.map((error) => error.property)).toContain('newPassword');
    });
  });

  it('changes the hash, clears the forced-change flag, and issues a fresh session', async () => {
    const result = await service.changePassword('user-id', {
      currentPassword: 'Temporary123',
      newPassword: 'NewPassword456',
      confirmPassword: 'NewPassword456',
    });

    const [, update] = userModel.findByIdAndUpdate.mock.calls[0];
    expect(update.mustChangePassword).toBe(false);
    expect(update.refreshTokens).toEqual([]);
    await expect(bcrypt.compare('NewPassword456', update.passwordHash)).resolves.toBe(true);
    expect(result).toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' });
    expect(activityLog.record).toHaveBeenCalledWith(expect.objectContaining({
      action: 'user.password_changed',
      entityId: 'user-id',
    }));
  });

  it('rejects a mismatch without changing the user', async () => {
    await expect(service.changePassword('user-id', {
      currentPassword: 'Temporary123',
      newPassword: 'NewPassword456',
      confirmPassword: 'MismatchPassword789',
    })).rejects.toThrow('Password confirmation does not match.');

    expect(userModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('rejects an incorrect current password without changing the user', async () => {
    await expect(service.changePassword('user-id', {
      currentPassword: 'NotTheTemporaryPassword123',
      newPassword: 'NewPassword456',
      confirmPassword: 'NewPassword456',
    })).rejects.toThrow('auth.invalid_credentials');

    expect(userModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });
});
