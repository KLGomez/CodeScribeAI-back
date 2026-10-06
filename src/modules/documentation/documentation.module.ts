import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DocumentationService } from './documentation.service';
import { DocumentationController } from './documentation.controller';
import {
  Documentation,
  DocumentationSchema,
} from './schemas/documentation.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Documentation.name, schema: DocumentationSchema },
    ]),
  ],
  providers: [DocumentationService],
  controllers: [DocumentationController],
  exports: [DocumentationService],
})
export class DocumentationModule {}
