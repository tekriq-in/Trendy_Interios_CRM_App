import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { ALLOW_PASSWORD_CHANGE_KEY } from '../decorators/allow-password-change.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const authenticated = await super.canActivate(context);
    if (!authenticated) return false;

    const request = context.switchToHttp().getRequest<{
      user?: { mustChangePassword?: boolean };
    }>();
    const passwordChangeAllowed = this.reflector.getAllAndOverride<boolean>(
      ALLOW_PASSWORD_CHANGE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (request.user?.mustChangePassword && !passwordChangeAllowed) {
      throw new ForbiddenException('auth.password_change_required');
    }

    return true;
  }
}
