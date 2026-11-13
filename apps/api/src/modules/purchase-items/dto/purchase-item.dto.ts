import { Transform, Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** Fields Design fills in. All six descriptive fields form the match key for cumulative adds. */
class PurchaseItemFieldsDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @Transform(trim)
  area?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  @Transform(trim)
  brand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  @Transform(trim)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  @Transform(trim)
  size?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  @Transform(trim)
  finish?: string;
}

/** POST /projects/:projectId/purchase-items — adds to an existing matching row or creates a new one. */
export class AddPurchaseItemDto extends PurchaseItemFieldsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Transform(trim)
  item: string;

  /** Quantity to ADD (not the new total) */
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity: number;
}

/** PATCH /purchase-items/:id — Design corrects details or sets the order qty total. */
export class UpdatePurchaseItemDetailsDto extends PurchaseItemFieldsDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Transform(trim)
  item?: string;

  /** New order qty total; must not be below the received qty */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity?: number;
}

/** PATCH /purchase-items/:id/progress — Purchase records ordering / receipt (manual). */
export class UpdatePurchaseItemProgressDto {
  /** Total ordered so far (not an increment) */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  orderedQty?: number;

  /** Total received so far (not an increment) */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  receivedQty?: number;
}
