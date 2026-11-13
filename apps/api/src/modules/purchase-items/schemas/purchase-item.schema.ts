import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { basePlugin } from '../../../common/schemas/base.plugin';

export type PurchaseItemDocument = PurchaseItem & Document;

export const PURCHASE_ITEM_STATUSES = ['pending', 'ordered', 'received'] as const;

@Schema({ timestamps: true })
export class PurchaseItem {
  @Prop({ type: Types.ObjectId, ref: 'Project', required: true })
  project: Types.ObjectId;

  /** S.No — display order within the project */
  @Prop({ type: Number, default: 0 })
  slNo: number;

  @Prop({ trim: true, default: '' })
  area: string;

  /** Item name */
  @Prop({ required: true, trim: true })
  item: string;

  @Prop({ trim: true, default: '' })
  brand: string;

  @Prop({ trim: true, default: '' })
  code: string;

  @Prop({ trim: true, default: '' })
  size: string;

  @Prop({ trim: true, default: '' })
  finish: string;

  /** Normalised area|item|brand|code|size|finish — repeated additions with the same key are merged */
  @Prop({ type: String, index: true })
  matchKey: string;

  /** Order qty — cumulative total requested by Design */
  @Prop({ type: Number, required: true, default: 0, min: 0 })
  quantity: number;

  /** Received qty — entered manually by Purchase */
  @Prop({ type: Number, default: 0, min: 0 })
  receivedQty: number;

  /** pending = "Yet to order" */
  @Prop({ type: String, enum: PURCHASE_ITEM_STATUSES, default: 'pending' })
  status: (typeof PURCHASE_ITEM_STATUSES)[number];

  @Prop()
  orderedAt: Date;

  @Prop()
  receivedAt: Date;
}

export const PurchaseItemSchema = SchemaFactory.createForClass(PurchaseItem);
PurchaseItemSchema.plugin(basePlugin);
PurchaseItemSchema.index({ project: 1, slNo: 1 });
PurchaseItemSchema.index({ project: 1, matchKey: 1 });
PurchaseItemSchema.index({ status: 1 });
