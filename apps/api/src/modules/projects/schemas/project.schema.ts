import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { basePlugin } from '../../../common/schemas/base.plugin';

export type ProjectDocument = Project & Document;

const StageHistorySchema = {
  stage: { type: Types.ObjectId, ref: 'Department', required: true },
  enteredAt: { type: Date, required: true, default: Date.now },
  completedAt: { type: Date },
};

const AdditionalWorkSchema = {
  description: { type: String, required: true },
  amount: { type: Number, required: true, default: 0 },
  notifiedClient: { type: Boolean, default: false },
  drawingRequired: { type: Boolean, default: false },
};

@Schema({ timestamps: true })
export class Project {
  @Prop({ type: Types.ObjectId, ref: 'Client', required: true })
  client: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ type: Types.ObjectId, ref: 'Department' })
  currentStage: Types.ObjectId;

  @Prop({ type: [StageHistorySchema], default: [] })
  stageHistory: Array<{
    stage: Types.ObjectId;
    enteredAt: Date;
    completedAt?: Date;
  }>;

  @Prop({ type: Number, default: 0, min: 0, max: 100 })
  progressPct: number;

  @Prop({ type: Map, of: Number, default: {} })
  stageWeights: Map<string, number>;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  assignedTeam: Types.ObjectId[];

  @Prop()
  targetDate: Date;

  @Prop({
    type: String,
    enum: ['active', 'on_hold', 'completed', 'cancelled'],
    default: 'active',
  })
  status: string;

  @Prop({ type: Number, default: 0 })
  advance: number;

  @Prop()
  advancePaidAt: Date;

  @Prop({ default: true })
  requiresDrawing: boolean;

  @Prop({ type: [AdditionalWorkSchema], default: [] })
  additionalWork: Array<{
    description: string;
    amount: number;
    notifiedClient: boolean;
    drawingRequired: boolean;
  }>;
}

export const ProjectSchema = SchemaFactory.createForClass(Project);
ProjectSchema.plugin(basePlugin);
ProjectSchema.index({ client: 1 });
ProjectSchema.index({ currentStage: 1 });
ProjectSchema.index({ assignedTeam: 1 });
ProjectSchema.index({ status: 1 });
