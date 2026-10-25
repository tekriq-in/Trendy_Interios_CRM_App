import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ClientMessageDocument = ClientMessage & Document;

@Schema({ timestamps: true })
export class ClientMessage {
  @Prop({ type: Types.ObjectId, ref: 'Client', required: true })
  client: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Project' })
  project: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Approval' })
  linkedApproval: Types.ObjectId;

  @Prop({ required: true })
  body: string;

  @Prop({ default: false })
  isRead: boolean;

  @Prop()
  receivedAt: Date;
}

export const ClientMessageSchema = SchemaFactory.createForClass(ClientMessage);
ClientMessageSchema.index({ client: 1 });
ClientMessageSchema.index({ isRead: 1 });
