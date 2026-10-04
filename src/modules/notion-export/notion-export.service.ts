import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Client, isNotionClientError, APIErrorCode } from '@notionhq/client';
import { markdownToBlocks } from '@tryfabric/martian';
import { ExportNotionDto } from './dto/export-notion.dto';

export interface NotionExportResult {
  success: boolean;
  url: string;
}

@Injectable()
export class NotionExportService {
  private readonly logger = new Logger(NotionExportService.name);

  /**
   * Exporta contenido Markdown a una nueva página en Notion dentro de una página padre (targetPageId).
   * Convierte la sintaxis Markdown en bloques nativos de Notion y maneja la paginación de bloques (>100).
   */
  async exportMarkdownToNotion(dto: ExportNotionDto): Promise<NotionExportResult> {
    // 1. Inicializar cliente con el token del usuario (OAuth / Internal Integration)
    const notion = new Client({
      auth: dto.notionAccessToken,
    });

    // 2. Parsear el Markdown a bloques compatibles con Notion utilizando @tryfabric/martian
    let blocks: any[];
    try {
      blocks = markdownToBlocks(dto.markdown);
    } catch (parseError: any) {
      this.logger.error(`Error al parsear Markdown con Martian: ${parseError?.message}`, parseError?.stack);
      throw new BadRequestException(
        `Error al parsear el contenido Markdown a bloques de Notion: ${parseError?.message || 'Formato Markdown inválido'}`,
      );
    }

    if (!Array.isArray(blocks) || blocks.length === 0) {
      // Si el Markdown estaba vacío o no generó bloques, generamos al menos un bloque de párrafo vacío
      blocks = [
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [],
          },
        },
      ];
    }

    // 3. Manejo de límites de la API de Notion:
    // notion.pages.create() admite un máximo de 100 bloques en la propiedad `children`.
    // Si el documento excede 100 bloques, los primeros 100 se envían al crear la página
    // y los restantes se añaden en bloques de hasta 100 mediante notion.blocks.children.append().
    const initialBlocks = blocks.slice(0, 100);
    const remainingBlocks = blocks.slice(100);

    try {
      this.logger.log(
        `Creando página en Notion: "${dto.title}" dentro de la página padre "${dto.targetPageId}" (${blocks.length} bloques totales)`,
      );

      const response = await notion.pages.create({
        parent: {
          page_id: dto.targetPageId,
        },
        properties: {
          title: {
            title: [
              {
                text: {
                  content: dto.title,
                },
              },
            ],
          },
        },
        children: initialBlocks,
      });

      // Añadir bloques restantes en lotes de 100 si el documento es extenso
      if (remainingBlocks.length > 0) {
        const chunkSize = 100;
        for (let i = 0; i < remainingBlocks.length; i += chunkSize) {
          const chunk = remainingBlocks.slice(i, i + chunkSize);
          await notion.blocks.children.append({
            block_id: response.id,
            children: chunk,
          });
        }
      }

      // 4. Obtener URL de la página generada (de la respuesta o fallback estructurado)
      const pageUrl =
        'url' in response && response.url
          ? response.url
          : `https://notion.so/${response.id.replace(/-/g, '')}`;

      this.logger.log(`Página exportada exitosamente a Notion: ${pageUrl}`);

      return {
        success: true,
        url: pageUrl,
      };
    } catch (error: any) {
      this.handleNotionError(error);
    }
  }

  /**
   * Mapea y traduce las excepciones de la API de Notion a excepciones HTTP de NestJS.
   */
  private handleNotionError(error: any): never {
    this.logger.error(`Error en la API de Notion: ${error?.message}`, error?.stack);

    if (isNotionClientError(error)) {
      switch (error.code) {
        case APIErrorCode.Unauthorized:
          throw new BadRequestException(
            'El token de acceso de Notion no es válido o ha expirado. Por favor, reautentica la cuenta.',
          );
        case APIErrorCode.RestrictedResource:
          throw new BadRequestException(
            'La integración no tiene permisos suficientes para acceder o escribir en este recurso de Notion.',
          );
        case APIErrorCode.ObjectNotFound:
          throw new BadRequestException(
            'La página destino (targetPageId) no fue encontrada. Asegúrate de haber compartido la página con la integración de Notion en la configuración de la página.',
          );
        case APIErrorCode.RateLimited:
          throw new BadRequestException(
            'Se ha superado el límite de peticiones hacia la API de Notion. Por favor, intenta de nuevo en unos momentos.',
          );
        case APIErrorCode.ValidationError:
          throw new BadRequestException(
            `Error de validación en la API de Notion: ${error.message}`,
          );
        default:
          throw new BadRequestException(`Error devuelto por la API de Notion [${error.code}]: ${error.message}`);
      }
    }

    if (error instanceof BadRequestException || error instanceof InternalServerErrorException) {
      throw error;
    }

    throw new InternalServerErrorException(
      `Error inesperado al exportar la documentación a Notion: ${error?.message || 'Error desconocido'}`,
    );
  }
}
