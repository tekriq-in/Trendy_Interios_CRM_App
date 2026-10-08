import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { basePlugin } from '../../../common/schemas/base.plugin';

export type TaskDocument = Task & Document;

@Schema({ timestamps: true })
export class Task {
  @Prop({ type: Types.ObjectId, ref: 'Project', required: true })
  project: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Department', required: true })
  department: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ trim: true })
  description: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  assignedTo: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['pending', 'in_progress', 'done', 'blocked'],
    default: 'pending',
  })
  status: string;

  @Prop()
  dueDate: Date;

  @Prop()
  completedAt: Date;

  @Prop()
  offlineCreatedAt: Date;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Document' }], default: [] })
  photos: Types.ObjectId[];
}

export const TaskSchema = SchemaFactory.createForClass(Task);
TaskSchema.plugin(basePlugin);
TaskSchema.index({ project: 1 });
TaskSchema.index({ assignedTo: 1 });
TaskSchema.index({ status: 1 });
