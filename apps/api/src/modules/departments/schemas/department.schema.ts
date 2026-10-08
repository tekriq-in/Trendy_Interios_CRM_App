import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { basePlugin } from '../../../common/schemas/base.plugin';

export type DepartmentDocument = Department & Document;

@Schema({ timestamps: true })
export class Department {
  @Prop({ required: true, unique: true, trim: true })
  name: string;

  @Prop({ trim: true })
  description: string;

  @Prop({ required: true, default: 0 })
  order: number;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ required: true, default: 48 })
  defaultSlaHours: number;
}

export const DepartmentSchema = SchemaFactory.createForClass(Department);
DepartmentSchema.plugin(basePlugin);
DepartmentSchema.index({ order: 1 });
