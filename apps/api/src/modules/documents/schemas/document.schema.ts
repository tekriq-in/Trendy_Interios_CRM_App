import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document as MongoDocument, Types } from 'mongoose';
import { basePlugin } from '../../../common/schemas/base.plugin';

export type DocumentDoc = TIDocument & MongoDocument;

@Schema({ timestamps: true })
export class TIDocument {
  @Prop({ type: Types.ObjectId, ref: 'Project' })
  project: Types.ObjectId;

  @Prop({ required: true })
  driveFileId: string;

  @Prop({ required: true })
  driveLink: string;

  @Prop({ required: true })
  mimeType: string;

  @Prop({ required: true })
  fileName: string;

  @Prop({ default: 0 })
  fileSize: number;

  @Prop({ default: 1 })
  version: number;

  @Prop({
    type: String,
    enum: ['photo', 'drawing_2d', 'drawing_3d', 'quotation', 'invoice', 'other'],
    default: 'other',
  })
  type: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  uploadedBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Department' })
  department: Types.ObjectId;

  @Prop({ default: false })
  isDeleted: boolean;
}

export const TIDocumentSchema = SchemaFactory.createForClass(TIDocument);
TIDocumentSchema.plugin(basePlugin);
TIDocumentSchema.index({ project: 1 });
TIDocumentSchema.index({ uploadedBy: 1 });
