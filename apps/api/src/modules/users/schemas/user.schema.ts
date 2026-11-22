import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { basePlugin } from '../../../common/schemas/base.plugin';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ trim: true })
  phone: string;

  @Prop({ required: true, select: false })
  passwordHash: string;

  @Prop({ default: false })
  mustChangePassword: boolean;

  @Prop({ type: Types.ObjectId, ref: 'Role', required: true })
  role: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Department' })
  department: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  reportsTo: Types.ObjectId;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Project' }], default: [] })
  assignedProjects: Types.ObjectId[];

  @Prop()
  fcmToken: string;

  @Prop({ default: false })
  mfaEnabled: boolean;

  @Prop({ select: false })
  mfaSecret: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: String, enum: ['en', 'ta'], default: 'en' })
  preferredLanguage: string;

  @Prop({ type: [String], default: [] })
  refreshTokens: string[];
}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.plugin(basePlugin);
// email unique index is declared via @Prop({ unique: true }) above
// phone sparse unique index declared via @Prop({ sparse: true }) + explicit index below
UserSchema.index({ phone: 1 }, { sparse: true, unique: true });
UserSchema.index({ role: 1 });
UserSchema.index({ department: 1 });
