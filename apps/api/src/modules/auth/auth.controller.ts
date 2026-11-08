import { Controller, Get, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto, MfaVerifyDto, RefreshDto, LogoutDto, MfaSetupConfirmDto } from './dto/login.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Get('permissions')
  @UseGuards(JwtAuthGuard)
  getPermissions(@CurrentUser() user: { rolePermissions?: string[] }) {
    return { permissions: user.rolePermissions ?? [] };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.identifier, dto.password);
  }

  @Post('mfa/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  verifyMfa(@Body() dto: MfaVerifyDto) {
    return this.authService.verifyMfa(dto.userId, dto.token);
  }

  @Post('mfa/setup')
  @UseGuards(JwtAuthGuard)
  setupMfa(@CurrentUser() user: { _id: string }) {
    return this.authService.setupMfa(user._id);
  }

  @Post('mfa/setup/confirm')
  @UseGuards(JwtAuthGuard)
  confirmMfa(@CurrentUser() user: { _id: string }, @Body() dto: MfaSetupConfirmDto) {
    return this.authService.confirmMfaSetup(user._id, dto.token);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@CurrentUser() user: { _id: string }, @Body() dto: LogoutDto) {
    return this.authService.logout(user._id, dto.refreshToken);
  }
}
