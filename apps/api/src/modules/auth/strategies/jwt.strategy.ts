import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../users/schemas/user.schema';

interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.userModel
      .findById(payload.sub)
      .populate<{ role: { permissions: string[] } }>('role', 'permissions')
      .lean();

    if (!user || !user.isActive) throw new UnauthorizedException('auth.invalid_token');

    return {
      _id: String(user._id),
      email: user.email,
      name: user.name,
      department: user.department,
      reportsTo: user.reportsTo,
      assignedProjects: user.assignedProjects,
      rolePermissions: (user.role as unknown as { permissions: string[] })?.permissions ?? [],
      mustChangePassword: user.mustChangePassword === true,
    };
  }
}
