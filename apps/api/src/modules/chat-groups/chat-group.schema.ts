import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { basePlugin } from '../../common/schemas/base.plugin';

export type ChatGroupDocument = ChatGroup & Document;

export type ChatGroupType = 'department' | 'project' | 'individual' | 'custom';

@Schema()
export class ChatGroup {
  @Prop({ required: true }) name: string;

  @Prop({ required: true, enum: ['department', 'project', 'individual', 'custom'] })
  type: ChatGroupType;

  @Prop({ required: true, unique: true }) channel: string;

  @Prop([{ type: Types.ObjectId, ref: 'User' }]) members: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'Project' }) projectRef?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Department' }) departmentRef?: Types.ObjectId;

  @Prop({ default: true }) isAutoCreated: boolean;

  @Prop({ default: true }) isActive: boolean;
}

export const ChatGroupSchema = SchemaFactory.createForClass(ChatGroup);
ChatGroupSchema.plugin(basePlugin);
