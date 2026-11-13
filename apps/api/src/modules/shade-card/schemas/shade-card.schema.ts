import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { basePlugin } from '../../../common/schemas/base.plugin';

export type ShadeCardEntryDocument = ShadeCardEntry & Document;

export const MATERIAL_TYPES = ['Acrylic', 'LAM', 'Louver', 'Veneer', 'PU', 'Membrane', 'Glass', 'Other'] as const;
export type MaterialType = typeof MATERIAL_TYPES[number];

@Schema({ timestamps: true })
export class ShadeCardEntry {
  @Prop({ type: Types.ObjectId, ref: 'Project', required: true, index: true })
  project: Types.ObjectId;

  @Prop({ required: true, trim: true })
  area: string;

  /** List of unit names this material applies to (e.g. GF_KITCHEN BASE UNIT, GF_WALL UNIT) */
  @Prop({ type: [String], default: [] })
  units: string[];

  @Prop({ type: String, enum: MATERIAL_TYPES, required: true })
  material: MaterialType;

  @Prop({ required: true, trim: true })
  codeName: string;

  @Prop({ trim: true })
  photoUrl?: string;

  @Prop({ trim: true })
  remarks?: string;

  /** Display order within the project */
  @Prop({ type: Number, default: 0 })
  slNo: number;

  /**
   * Shade-card revision in which this entry was first sent to the client (R1, R2, …).
   * Unset = added since the last send (draft; will go out in the next revision).
   */
  @Prop({ type: Number })
  revision?: number;
}

export const ShadeCardEntrySchema = SchemaFactory.createForClass(ShadeCardEntry);
ShadeCardEntrySchema.plugin(basePlugin);
ShadeCardEntrySchema.index({ project: 1, slNo: 1 });
