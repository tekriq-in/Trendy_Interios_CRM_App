import {
  IsString, IsEmail, IsOptional, IsEnum, IsMongoId, IsBoolean,
  MinLength, MaxLength, Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateUserDto {
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters.' })
  @MaxLength(100, { message: 'Name must not exceed 100 characters.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name: string;

  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(150)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9\s\-()]{7,15}$/, {
    message: 'Enter a valid phone number (7–15 digits, optional +, spaces, hyphens).',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  phone?: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters.' })
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number.',
  })
  password: string;

  @IsMongoId({ message: 'roleId must be a valid ID.' })
  roleId: string;

  @IsOptional()
  @IsMongoId({ message: 'departmentId must be a valid ID.' })
  departmentId?: string;

  @IsOptional()
  @IsMongoId({ message: 'reportsToId must be a valid ID.' })
  reportsToId?: string;

  @IsOptional()
  @IsEnum(['en', 'ta'], { message: 'preferredLanguage must be "en" or "ta".' })
  preferredLanguage?: 'en' | 'ta';
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters.' })
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9\s\-()]{7,15}$/, {
    message: 'Enter a valid phone number (7–15 digits, optional +, spaces, hyphens).',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  phone?: string;

  @IsOptional()
  @IsMongoId({ message: 'roleId must be a valid ID.' })
  roleId?: string;

  @IsOptional()
  @IsMongoId({ message: 'departmentId must be a valid ID.' })
  departmentId?: string | null;

  @IsOptional()
  @IsMongoId({ message: 'reportsToId must be a valid ID.' })
  reportsToId?: string;

  @IsOptional()
  @IsEnum(['en', 'ta'], { message: 'preferredLanguage must be "en" or "ta".' })
  preferredLanguage?: 'en' | 'ta';

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  fcmToken?: string;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters.' })
  @MaxLength(128, { message: 'Password must not exceed 128 characters.' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number.',
  })
  password: string;

  @IsString()
  @MaxLength(128, { message: 'Password confirmation must not exceed 128 characters.' })
  confirmPassword: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(1, { message: 'Current password is required.' })
  @MaxLength(128, { message: 'Current password must not exceed 128 characters.' })
  currentPassword: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters.' })
  @MaxLength(128, { message: 'Password must not exceed 128 characters.' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number.',
  })
  newPassword: string;

  @IsString()
  @MaxLength(128, { message: 'Password confirmation must not exceed 128 characters.' })
  confirmPassword: string;
}
