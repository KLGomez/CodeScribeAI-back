import { Module } from '@nestjs/common';
import { NotionExportController } from './notion-export.controller';
import { NotionExportService } from './notion-export.service';

@Module({
  controllers: [NotionExportController],
  providers: [NotionExportService],
  exports: [NotionExportService],
})
export class NotionExportModule {}
