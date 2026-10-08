import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { basePlugin } from '../../../common/schemas/base.plugin';

export type PurchaseItemDocument = PurchaseItem & Document;

@Schema({ timestamps: true })
export class PurchaseItem {
  @Prop({ type: Types.ObjectId, ref: 'Project', required: true })
  project: Types.ObjectId;

  @Prop({ required: true, trim: true })
  item: string;

  @Prop({ trim: true })
  description: string;

  @Prop({ required: true, default: 1 })
  quantity: number;

  @Prop({ trim: true })
  unit: string;

  @Prop({ trim: true })
  supplier: string;

  @Prop({
    type: String,
    enum: ['pending', 'ordered', 'received'],
    default: 'pending',
  })
  status: string;

  @Prop()
  orderedAt: Date;

  @Prop()
  receivedAt: Date;

  @Prop({ type: Types.ObjectId, ref: 'Document' })
  linkedDocument: Types.ObjectId;
}

export const PurchaseItemSchema = SchemaFactory.createForClass(PurchaseItem);
PurchaseItemSchema.plugin(basePlugin);
PurchaseItemSchema.index({ project: 1 });
PurchaseItemSchema.index({ status: 1 });
