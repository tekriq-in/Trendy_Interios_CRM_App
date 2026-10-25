import { IsString, IsOptional, IsNumber, IsPositive, Min, Max, MaxLength, MinLength } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateDepartmentDto {
  @IsString()
  @MinLength(2, { message: 'Department name must be at least 2 characters.' })
  @MaxLength(80, { message: 'Department name must not exceed 80 characters.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  description?: string;

  @IsNumber({}, { message: 'order must be a number.' })
  @IsPositive({ message: 'order must be a positive number.' })
  @Type(() => Number)
  order: number;

  @IsOptional()
  @IsNumber({}, { message: 'defaultSlaHours must be a number.' })
  @Min(1, { message: 'SLA hours must be at least 1.' })
  @Max(8760, { message: 'SLA hours must not exceed 8760 (1 year).' })
  @Type(() => Number)
  defaultSlaHours?: number;
}

export class UpdateDepartmentDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Department name must be at least 2 characters.' })
  @MaxLength(80)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  description?: string;

  @IsOptional()
  @IsNumber({}, { message: 'order must be a number.' })
  @IsPositive()
  @Type(() => Number)
  order?: number;

  @IsOptional()
  @IsNumber({}, { message: 'defaultSlaHours must be a number.' })
  @Min(1)
  @Max(8760)
  @Type(() => Number)
  defaultSlaHours?: number;
}
