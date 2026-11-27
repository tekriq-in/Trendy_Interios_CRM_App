import { IsString, IsOptional, IsEnum, IsMongoId, MinLength, MaxLength, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

export class RaiseBlockerDto {
  @IsOptional()
  @IsUUID()
  clientRequestId?: string;

  @IsMongoId({ message: 'projectId must be a valid ID.' })
  projectId: string;

  @IsString()
  @MinLength(5, { message: 'Title must be at least 5 characters.' })
  @MaxLength(200, { message: 'Title must not exceed 200 characters.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Description must not exceed 2000 characters.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  description?: string;

  @IsEnum(['internal', 'client_side'], {
    message: 'type must be "internal" or "client_side".',
  })
  type: 'internal' | 'client_side';
}
