import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { basePlugin } from '../../../common/schemas/base.plugin';

export type HandoverDocument = Handover & Document;

@Schema({ timestamps: true })
export class Handover {
  @Prop({ type: Types.ObjectId, ref: 'Project', required: true })
  project: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Department', required: true })
  fromDepartment: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Department', required: true })
  toDepartment: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  raisedBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  confirmedBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  acceptedBy: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['draft', 'confirmed', 'accepted', 'rejected'],
    default: 'draft',
  })
  status: string;

  @Prop({ trim: true })
  rejectionReason: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Document' }], default: [] })
  proofFiles: Types.ObjectId[];

  @Prop({ trim: true })
  notes: string;
}

export const HandoverSchema = SchemaFactory.createForClass(Handover);
HandoverSchema.plugin(basePlugin);
HandoverSchema.index({ project: 1 });
HandoverSchema.index({ status: 1 });
