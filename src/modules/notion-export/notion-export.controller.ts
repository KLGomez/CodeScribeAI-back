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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { NotionExportService, NotionExportResult } from './notion-export.service';
import { ExportNotionDto } from './dto/export-notion.dto';

@ApiTags('Export')
@ApiBearerAuth()
@Controller('export')
@UseGuards(JwtAuthGuard)
export class NotionExportController {
  constructor(private readonly notionExportService: NotionExportService) {}

  /**
   * POST /api/export/notion
   * Exporta documentación técnica en Markdown directamente como una página nativa en Notion.
   */
  @Post('notion')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Exportar documentación Markdown a Notion',
    description:
      'Transforma el contenido Markdown a bloques JSON nativos de Notion y crea una nueva página dentro de la página padre indicada.',
  })
  @ApiResponse({
    status: 200,
    description: 'Documentación exportada exitosamente a Notion.',
    schema: {
      example: {
        success: true,
        url: 'https://www.notion.so/CodeScribe-Doc-1234567890abcdef',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'Error de validación, sintaxis Markdown incompatible o token de Notion inválido.',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado (token JWT de la sesión ausente o inválido).',
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno del servidor durante la exportación a Notion.',
  })
  async exportToNotion(@Body() dto: ExportNotionDto): Promise<NotionExportResult> {
    return this.notionExportService.exportMarkdownToNotion(dto);
  }
}
