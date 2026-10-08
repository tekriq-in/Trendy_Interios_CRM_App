import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { basePlugin } from '../../../common/schemas/base.plugin';

export type SlaSettingsDocument = SlaSettings & Document;

@Schema({ timestamps: true })
export class SlaSettings {
  @Prop({ type: Types.ObjectId, ref: 'Department', required: true, unique: true })
  department: Types.ObjectId;

  @Prop({ required: true, default: 48 })
  defaultHours: number;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  updatedBy: Types.ObjectId;
}

export const SlaSettingsSchema = SchemaFactory.createForClass(SlaSettings);
SlaSettingsSchema.plugin(basePlugin);
