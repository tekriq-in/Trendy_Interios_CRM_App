import {
  IsString, IsEmail, IsOptional, IsBoolean, IsEnum,
  MinLength, MaxLength, Matches, IsIn, IsObject,
} from 'class-validator';
import { Transform } from 'class-transformer';

const LEAD_SOURCES = ['marketing', 'referral', 'walkin', 'other'] as const;

export class CreateClientDto {
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters.' })
  @MaxLength(100, { message: 'Name must not exceed 100 characters.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name: string;

  @IsString()
  @Matches(/^\+?[0-9\s\-()]{7,15}$/, {
    message: 'Enter a valid phone number (7–15 digits, optional +, spaces, hyphens).',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  phone: string;

  @IsOptional()
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(150)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  address?: string;

  @IsOptional()
  @IsIn(LEAD_SOURCES, { message: `leadSource must be one of: ${LEAD_SOURCES.join(', ')}.` })
  leadSource?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  referredBy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  notes?: string;

  @IsOptional()
  @IsObject()
  location?: { coordinates: [number, number] };

  @IsOptional()
  @IsBoolean()
  whatsappOptIn?: boolean;
}

export class UpdateClientDto {
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
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(150)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  address?: string;

  @IsOptional()
  @IsIn(LEAD_SOURCES, { message: `leadSource must be one of: ${LEAD_SOURCES.join(', ')}.` })
  leadSource?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  referredBy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  notes?: string;

  @IsOptional()
  @IsBoolean()
  whatsappOptIn?: boolean;
}
