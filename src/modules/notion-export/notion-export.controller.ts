import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserDocument } from '../users/schemas/user.schema';
import { NotionExportService, NotionExportResult } from './notion-export.service';
import { ExportNotionDto } from './dto/export-notion.dto';

@ApiTags('Export')
@ApiBearerAuth()
@Controller('export')
@UseGuards(JwtAuthGuard)
export class NotionExportController {
  constructor(private readonly notionExportService: NotionExportService) {}

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('notion')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Exportar documentación Markdown a Notion',
    description:
      'Transforma el contenido Markdown de un documento a bloques nativos de Notion y crea una página dentro del padre indicado, usando las credenciales vinculadas del usuario.',
  })
  @ApiResponse({
    status: 200,
    description: 'Documentación exportada exitosamente a Notion.',
  })
  async exportToNotion(
    @CurrentUser() user: UserDocument,
    @Body() dto: ExportNotionDto,
  ): Promise<NotionExportResult> {
    return this.notionExportService.exportMarkdownToNotion(user, dto);
  }
}
