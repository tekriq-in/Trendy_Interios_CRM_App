import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { basePlugin } from '../../../common/schemas/base.plugin';

export type ApprovalDocument = Approval & Document;

@Schema({ timestamps: true })
export class Approval {
  @Prop({ type: Types.ObjectId, ref: 'Project', required: true })
  project: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['quotation', 'order_confirmation', 'client_update', 'drawing'],
    required: true,
  })
  kind: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  requestedBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  approver: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  })
  status: string;

  @Prop({ trim: true })
  rejectionReason: string;

  @Prop({ type: Types.ObjectId, ref: 'Document' })
  linkedDocument: Types.ObjectId;

  @Prop()
  approvedAt: Date;

  @Prop({ default: false })
  whatsappScheduled: boolean;
}

export const ApprovalSchema = SchemaFactory.createForClass(Approval);
ApprovalSchema.plugin(basePlugin);
ApprovalSchema.index({ project: 1 });
ApprovalSchema.index({ status: 1 });
ApprovalSchema.index({ kind: 1 });
