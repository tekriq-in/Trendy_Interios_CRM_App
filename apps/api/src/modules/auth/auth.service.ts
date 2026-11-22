import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';
import { ConfigService } from '@nestjs/config';
import { User, UserDocument } from '../users/schemas/user.schema';
import { ChangePasswordDto } from '../users/dto/user.dto';
import { ActivityLogService } from '../activity-log/activity-log.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private config: ConfigService,
    private activityLog: ActivityLogService,
  ) {}

  async login(identifier: string, password: string) {
    const trimmed = identifier.trim();
    const isPhone = /^[+\d][\d\s\-()]*$/.test(trimmed) && !trimmed.includes('@');
    const normalizedPhone = trimmed.replace(/[\s\-()]/g, '');

    const query = isPhone
      ? { phone: normalizedPhone, isActive: true }
      : { email: trimmed.toLowerCase(), isActive: true };

    const user = await this.userModel
      .findOne(query)
      .select('+passwordHash +mfaSecret')
      .populate<{ role: { _id: string; permissions: string[]; name: string } }>('role', 'permissions name')
      .populate<{ department: { _id: string; name: string } | null }>('department', 'name')
      .lean();

    if (!user) throw new UnauthorizedException('auth.invalid_credentials');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('auth.invalid_credentials');

    if (user.mfaEnabled) {
      return { requiresMfa: true, userId: String(user._id) };
    }

    return this.generateTokens(user);
  }

  async verifyMfa(userId: string, token: string) {
    const user = await this.userModel
      .findById(userId)
      .select('+mfaSecret')
      .populate<{ role: { _id: string; permissions: string[]; name: string } }>('role', 'permissions name')
      .populate<{ department: { _id: string; name: string } | null }>('department', 'name')
      .lean();

    if (!user) throw new UnauthorizedException('auth.invalid_token');

    const valid = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token,
      window: 1,
    });

    if (!valid) throw new UnauthorizedException('auth.invalid_mfa_token');

    return this.generateTokens(user);
  }

  async setupMfa(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new BadRequestException('user.not_found');
    if (user.mfaEnabled) throw new ConflictException('auth.mfa_already_enabled');

    const secret = speakeasy.generateSecret({
      name: `TrendyInteriors (${user.email})`,
      length: 20,
    });

    await this.userModel.findByIdAndUpdate(userId, { mfaSecret: secret.base32 });

    const qrUrl = await qrcode.toDataURL(secret.otpauth_url!);
    // Return only the QR code — never expose the raw TOTP secret over the wire
    return { qrCode: qrUrl };
  }

  async confirmMfaSetup(userId: string, token: string) {
    const user = await this.userModel.findById(userId).select('+mfaSecret').lean();
    if (!user) throw new BadRequestException('user.not_found');

    const valid = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token,
      window: 1,
    });

    if (!valid) throw new UnauthorizedException('auth.invalid_mfa_token');

    await this.userModel.findByIdAndUpdate(userId, { mfaEnabled: true });
    return { mfaEnabled: true };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
      }) as { sub: string };

      const user = await this.userModel
        .findOne({ _id: payload.sub, refreshTokens: refreshToken, isActive: true })
        .populate<{ role: { _id: string; permissions: string[]; name: string } }>('role', 'permissions name')
        .lean();

      if (!user) throw new UnauthorizedException('auth.invalid_token');

      await this.userModel.findByIdAndUpdate(payload.sub, {
        $pull: { refreshTokens: refreshToken },
      });

      return this.generateTokens(user);
    } catch {
      throw new UnauthorizedException('auth.invalid_token');
    }
  }

  async logout(userId: string, refreshToken: string) {
    await this.userModel.findByIdAndUpdate(userId, {
      $pull: { refreshTokens: refreshToken },
    });
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('Password confirmation does not match.');
    }

    const user = await this.userModel.findById(userId).select('+passwordHash').lean();
    if (!user) throw new UnauthorizedException('auth.invalid_token');

    const currentPasswordValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!currentPasswordValid) throw new UnauthorizedException('auth.invalid_credentials');
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('New password must be different from the current password.');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    const updatedUser = await this.userModel.findByIdAndUpdate(
      userId,
      { passwordHash, mustChangePassword: false, refreshTokens: [] },
      { new: true },
    )
      .populate<{ role: { _id: string; permissions: string[]; name: string } }>('role', 'permissions name')
      .populate<{ department: { _id: string; name: string } | null }>('department', 'name')
      .lean();

    if (!updatedUser) throw new UnauthorizedException('auth.invalid_token');

    await this.activityLog.record({
      actor: userId,
      action: 'user.password_changed',
      entity: 'users',
      entityId: userId,
    });

    return this.generateTokens(updatedUser);
  }

  private async generateTokens(user: {
    _id: unknown;
    email: string;
    name?: string;
    role?: { name: string } | string;
    department?: { _id: string | object; name?: string } | null;
    mustChangePassword?: boolean;
  }) {
    const sub = String(user._id);
    const roleName = typeof user.role === 'object' && user.role ? user.role.name : (user.role ?? 'Staff');
    const dept = user.department && typeof user.department === 'object' && 'name' in user.department && user.department.name
      ? { id: String(user.department._id), name: user.department.name }
      : null;
    const accessToken = this.jwtService.sign(
      {
        sub,
        email: user.email,
        name: user.name ?? '',
        role: roleName,
        department: dept,
        mustChangePassword: user.mustChangePassword === true,
      },
      { expiresIn: this.config.get('JWT_ACCESS_EXPIRES', '15m') },
    );
    const refreshToken = this.jwtService.sign(
      { sub, email: user.email },
      {
        secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES', '7d'),
      },
    );

    // Keep only the 10 most recent refresh tokens to prevent unbounded array growth
    await this.userModel.findByIdAndUpdate(sub, {
      $push: { refreshTokens: { $each: [refreshToken], $slice: -10 } },
    });

    return { accessToken, refreshToken };
  }
}
