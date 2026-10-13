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

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.userModel
      .findOne({ email: email.toLowerCase(), isActive: true })
      .select('+passwordHash +mfaSecret')
      .populate<{ role: { _id: string; permissions: string[]; name: string } }>('role', 'permissions name')
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
    return { secret: secret.base32, qrCode: qrUrl };
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

  private async generateTokens(user: { _id: unknown; email: string; name?: string; role?: { name: string } | string }) {
    const sub = String(user._id);
    const roleName = typeof user.role === 'object' && user.role ? user.role.name : (user.role ?? 'Staff');
    const accessToken = this.jwtService.sign(
      { sub, email: user.email, name: user.name ?? '', role: roleName },
      { expiresIn: this.config.get('JWT_ACCESS_EXPIRES', '15m') },
    );
    const refreshToken = this.jwtService.sign(
      { sub, email: user.email },
      {
        secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES', '7d'),
      },
    );

    await this.userModel.findByIdAndUpdate(sub, {
      $push: { refreshTokens: refreshToken },
    });

    return { accessToken, refreshToken };
  }
}
