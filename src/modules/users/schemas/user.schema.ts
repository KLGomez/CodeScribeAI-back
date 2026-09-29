import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true })
  githubId: string;

  @Prop({ required: true })
  username: string;

  @Prop()
  displayName: string;

  @Prop()
  avatarUrl: string;

  @Prop()
  email: string;

  /** AES-256 encrypted GitHub access token */
  @Prop({ select: false })
  githubToken: string;

  @Prop({ default: 'free', enum: ['free', 'pro'] })
  plan: string;

  @Prop({ default: 0 })
  analysisCount: number;
}

export const UserSchema = SchemaFactory.createForClass(User);
