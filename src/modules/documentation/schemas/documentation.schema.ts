import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DocumentationDocument = Documentation & Document;

@Schema({ timestamps: true })
export class Documentation {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
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

  @Prop({ default: 0 })
  filesAnalyzed?: number;

  @Prop({ default: 0 })
  filesTotal?: number;

  @Prop({ default: false })
  truncated?: boolean;

  /** TTL index for automatic ephemeral demo document cleanup */
  @Prop({ type: Date, index: { expireAfterSeconds: 0 } })
  expiresAt?: Date;
}

export const DocumentationSchema = SchemaFactory.createForClass(Documentation);

// B-11: Indice compuesto para listados de documentos por usuario
DocumentationSchema.index({ userId: 1, createdAt: -1 });
