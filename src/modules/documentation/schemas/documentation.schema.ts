import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DocumentationDocument = Documentation & Document;

@Schema({ timestamps: true })
export class Documentation {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Job', required: true })
  jobId: Types.ObjectId;

  @Prop({ required: true })
  repoUrl: string;

  @Prop({ required: true })
  content: string;

  @Prop({ type: [String], default: [] })
  sections: string[];

  @Prop({ default: 0 })
  tokensUsed: number;
}

export const DocumentationSchema = SchemaFactory.createForClass(Documentation);
