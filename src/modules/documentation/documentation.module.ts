import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DocumentationService } from './documentation.service';
import { DocumentationController } from './documentation.controller';
import {
  Documentation,
  DocumentationSchema,
} from './schemas/documentation.schema';

import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Documentation.name, schema: DocumentationSchema },
    ]),
    AiGatewayModule,
  ],
  providers: [DocumentationService],
  controllers: [DocumentationController],
  exports: [DocumentationService],
})
export class DocumentationModule {}
