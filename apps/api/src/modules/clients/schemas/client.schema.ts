import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { basePlugin } from '../../../common/schemas/base.plugin';

export type ClientDocument = Client & Document;

@Schema({ timestamps: true })
export class Client {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  phone: string;

  @Prop({ lowercase: true, trim: true })
  email: string;

  @Prop({
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: { type: [Number] },
  })
  location: { type: string; coordinates: number[] };

  @Prop({ trim: true })
  address: string;

  @Prop({
    type: String,
    enum: ['marketing', 'referral', 'walkin', 'other'],
    default: 'other',
  })
  leadSource: string;

  @Prop({ trim: true })
  referredBy: string;

  @Prop({ trim: true })
  notes: string;

  @Prop({ default: false })
  whatsappOptIn: boolean;
}

export const ClientSchema = SchemaFactory.createForClass(Client);
ClientSchema.plugin(basePlugin);
ClientSchema.index({ location: '2dsphere' });
