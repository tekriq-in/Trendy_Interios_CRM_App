import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { basePlugin } from '../../../common/schemas/base.plugin';

export type BlockerDocument = Blocker & Document;

@Schema({ timestamps: true })
export class Blocker {
  @Prop({ type: String, unique: true, sparse: true })
  clientRequestId?: string;

  @Prop({ type: Types.ObjectId, ref: 'Project', required: true })
  project: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  raisedBy: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ type: String, enum: ['internal', 'client_side'], required: true })
  type: string;

  @Prop({
    type: String,
    enum: ['open', 'sla_triggered', 'resolved'],
    default: 'open',
  })
  status: string;

  @Prop()
  slaTriggeredAt: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  slaTriggeredBy: Types.ObjectId;

  @Prop()
  resolvedAt: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  resolvedBy: Types.ObjectId;
}

export const BlockerSchema = SchemaFactory.createForClass(Blocker);
BlockerSchema.plugin(basePlugin);
BlockerSchema.index({ project: 1 });
BlockerSchema.index({ status: 1 });
