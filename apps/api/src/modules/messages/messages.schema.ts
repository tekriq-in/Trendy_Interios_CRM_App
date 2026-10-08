import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { basePlugin } from '../../common/schemas/base.plugin';

export type MessageDocument = Message & Document;

@Schema()
export class Message {
  @Prop({ required: true }) channel: string;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true }) sender: Types.ObjectId;
  @Prop({ required: true }) body: string;
  @Prop([{ type: Types.ObjectId, ref: 'Document' }]) attachments: Types.ObjectId[];
  @Prop([{ user: { type: Types.ObjectId, ref: 'User' }, readAt: Date }])
  readBy: { user: Types.ObjectId; readAt: Date }[];
}

export const MessageSchema = SchemaFactory.createForClass(Message);
MessageSchema.plugin(basePlugin);
