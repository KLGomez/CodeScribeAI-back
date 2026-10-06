import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RepositoryDocument = Repository & Document;

@Schema({ timestamps: true })
export class Repository {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  url: string;

  @Prop({ required: true })
  owner: string;

  @Prop({ required: true })
  name: string;

  /** TTL index for automatic ephemeral demo repository cleanup */
  @Prop({ type: Date, index: { expireAfterSeconds: 0 } })
  expiresAt?: Date;
}

export const RepositorySchema = SchemaFactory.createForClass(Repository);
