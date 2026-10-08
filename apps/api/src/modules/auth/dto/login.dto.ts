import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

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
