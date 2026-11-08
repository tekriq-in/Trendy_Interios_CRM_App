import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @MinLength(1)
  /** Email address (for MD/GM) or phone number (for all other staff) */
  identifier: string;

  @IsString()
  @MinLength(6)
  password: string;
}

export class MfaVerifyDto {
  @IsString()
  userId: string;

  @IsString()
  token: string;
}

export class RefreshDto {
  @IsString()
  refreshToken: string;
}

export class LogoutDto {
  @IsString()
  refreshToken: string;
}

export class MfaSetupConfirmDto {
  @IsString()
  token: string;
}
