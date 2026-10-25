import {
  IsString, IsOptional, IsMongoId, IsBoolean, IsDateString,
  IsArray, IsEnum, IsObject, MinLength, MaxLength,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateProjectDto {
  @IsMongoId({ message: 'clientId must be a valid ID.' })
  clientId: string;

  @IsString()
  @MinLength(2, { message: 'Project title must be at least 2 characters.' })
  @MaxLength(150, { message: 'Project title must not exceed 150 characters.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  title: string;

  @IsOptional()
  @IsMongoId({ message: 'firstStageId must be a valid ID.' })
  firstStageId?: string;

  @IsOptional()
  @IsDateString({}, { message: 'targetDate must be a valid ISO date string.' })
  targetDate?: Date;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true, message: 'Each assignedTeamId must be a valid ID.' })
  assignedTeamIds?: string[];

  @IsOptional()
  @IsBoolean()
  requiresDrawing?: boolean;
}

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Project title must be at least 2 characters.' })
  @MaxLength(150)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  title?: string;

  @IsOptional()
  @IsDateString({}, { message: 'targetDate must be a valid ISO date string.' })
  targetDate?: Date;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true, message: 'Each assignedTeamId must be a valid ID.' })
  assignedTeamIds?: string[];

  @IsOptional()
  @IsEnum(['active', 'on_hold', 'completed', 'cancelled'], {
    message: 'status must be one of: active, on_hold, completed, cancelled.',
  })
  status?: string;

  @IsOptional()
  @IsObject()
  stageWeights?: Record<string, number>;
}
