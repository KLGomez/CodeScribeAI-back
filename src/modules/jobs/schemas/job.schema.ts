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
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  repoUrl: string;

  @Prop({
    required: true,
    default: JobStatus.QUEUED,
    enum: Object.values(JobStatus),
  })
  status: JobStatus;

  @Prop()
  documentationId: string;

  @Prop()
  errorMessage: string;

  @Prop({ default: 0, min: 0, max: 100 })
  progress: number;

  @Prop()
  tokensUsed: number;

  @Prop()
  durationMs: number;
}

export const JobSchema = SchemaFactory.createForClass(Job);
