import { Controller, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, MfaVerifyDto, RefreshDto, LogoutDto, MfaSetupConfirmDto } from './dto/login.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Post('mfa/verify')
  @HttpCode(HttpStatus.OK)
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
