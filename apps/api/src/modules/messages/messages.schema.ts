import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { basePlugin } from '../../common/schemas/base.plugin';

export type MessageDocument = Message & Document;

@Schema()
export class Message {
  @Prop({ required: true }) channel: string;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true }) sender: Types.ObjectId;
  @Prop({ required: true, default: '' }) body: string;
  @Prop([{ type: Types.ObjectId, ref: 'Document' }]) attachments: Types.ObjectId[];
  @Prop([{ type: Types.ObjectId, ref: 'User' }]) mentions: Types.ObjectId[];
  @Prop({ type: String, enum: ['image', 'video', 'audio', 'file'], default: null }) mediaType: string | null;
  @Prop({ type: String, default: null }) mediaUrl: string | null;
  @Prop({ type: Boolean, default: false }) isDeleted: boolean;
  @Prop({ type: Date, default: null }) editedAt?: Date;
  @Prop({ type: Date, default: null }) deletedAt?: Date;
  @Prop([{ user: { type: Types.ObjectId, ref: 'User' }, readAt: Date }])
  readBy: { user: Types.ObjectId; readAt: Date }[];
}

export const MessageSchema = SchemaFactory.createForClass(Message);
MessageSchema.plugin(basePlugin);
