import { IsString, IsArray, IsEnum, IsOptional, IsNumber, MinLength, ArrayMinSize } from 'class-validator';
import { MATERIAL_TYPES } from '../schemas/shade-card.schema';

export class CreateShadeCardEntryDto {
  @IsString()
  @MinLength(1)
  area: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  units: string[];

  @IsEnum(MATERIAL_TYPES)
  material: typeof MATERIAL_TYPES[number];

  @IsString()
  @MinLength(1)
  codeName: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsNumber()
  slNo?: number;
}

export class UpdateShadeCardEntryDto {
  @IsOptional()
  @IsString()
  area?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  units?: string[];

  @IsOptional()
  @IsEnum(MATERIAL_TYPES)
  material?: typeof MATERIAL_TYPES[number];

  @IsOptional()
  @IsString()
  codeName?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsNumber()
  slNo?: number;
}
