import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type JobDocument = Job & Document;

export enum JobStatus {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  DONE = 'done',
  ERROR = 'error',
}

@Schema({ timestamps: true })
export class Job {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  repoUrl: string;

  @Prop({
    type: String,
    required: true,
    default: JobStatus.QUEUED,
    enum: Object.values(JobStatus),
  })
  status: JobStatus;

  @Prop()
  stage?: string;

  @Prop()
  documentationId?: string;

  @Prop()
  errorCode?: string;

  @Prop()
  errorMessage?: string;

  @Prop({ default: 0, min: 0, max: 100 })
  progress: number;

  @Prop()
  tokensUsed?: number;

  @Prop()
  durationMs?: number;

  /** TTL index for automatic ephemeral demo job cleanup */
  @Prop({ type: Date, index: { expireAfterSeconds: 0 } })
  expiresAt?: Date;
}

export const JobSchema = SchemaFactory.createForClass(Job);

// B-11: Indice compuesto para busqueda eficiente de jobs por usuario y orden cronologico
JobSchema.index({ userId: 1, createdAt: -1 });
