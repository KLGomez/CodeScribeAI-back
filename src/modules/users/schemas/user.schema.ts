import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ _id: false })
export class NotionIntegration {
  /** AES-256-GCM encrypted Notion access token */
  @Prop({ select: false })
  accessTokenEnc: string;

  @Prop()
  workspaceName?: string;

  @Prop()
  workspaceId?: string;

  @Prop()
  botId?: string;

  @Prop()
  connectedAt?: Date;
}

export const NotionIntegrationSchema = SchemaFactory.createForClass(NotionIntegration);

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

  @Prop({ default: false })
  isDemo: boolean;

  /** TTL index for automatic ephemeral demo session cleanup */
  @Prop({ type: Date, index: { expireAfterSeconds: 0 } })
  expiresAt?: Date;

  @Prop({ type: NotionIntegrationSchema })
  notion?: NotionIntegration;
}

export const UserSchema = SchemaFactory.createForClass(User);
