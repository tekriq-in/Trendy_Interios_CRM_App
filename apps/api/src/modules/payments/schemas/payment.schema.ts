import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { basePlugin } from '../../../common/schemas/base.plugin';

export type PaymentDocument = Payment & Document;

@Schema({ timestamps: true })
export class Payment {
  @Prop({ type: Types.ObjectId, ref: 'Project', required: true })
  project: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['advance', 'periodic', 'final'],
    required: true,
  })
  kind: string;

  @Prop({ required: true, min: 0 })
  amount: number;

  @Prop()
  paidAt: Date;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  collectedBy: Types.ObjectId;

  @Prop({ trim: true })
  notes: string;

  @Prop()
  followUpSentAt: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  followUpApprovedBy: Types.ObjectId;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
PaymentSchema.plugin(basePlugin);
PaymentSchema.index({ project: 1 });
PaymentSchema.index({ kind: 1 });
