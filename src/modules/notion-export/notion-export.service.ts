import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { Client, isNotionClientError, APIErrorCode } from '@notionhq/client';
import { markdownToBlocks } from '@tryfabric/martian';
import { ExportNotionDto } from './dto/export-notion.dto';
import { Documentation, DocumentationDocument } from '../documentation/schemas/documentation.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { decryptToken } from '../../common/utils/crypto.util';

export interface NotionExportResult {
  success: boolean;
  url: string;
}

@Injectable()
export class NotionExportService {
  private readonly logger = new Logger(NotionExportService.name);

  constructor(
    @InjectModel(Documentation.name)
    private docModel: Model<DocumentationDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    private configService: ConfigService,
  ) {}

  /**
   * Sanitiza y divide fragmentos de texto en rich_text que excedan el límite estricto de Notion (2.000 caracteres)
   */
  private sanitizeBlocks(blocks: any[]): any[] {
    const result: any[] = [];

    for (const block of blocks) {
      const type = block.type;
      if (block[type] && Array.isArray(block[type].rich_text)) {
        const splitRichText: any[] = [];
        for (const rt of block[type].rich_text) {
          const content = rt.text?.content || rt.plain_text || '';
          if (content.length > 2000) {
            for (let i = 0; i < content.length; i += 2000) {
              const slice = content.slice(i, i + 2000);
              splitRichText.push({
                ...rt,
                text: { ...rt.text, content: slice },
                plain_text: slice,
              });
            }
          } else {
            splitRichText.push(rt);
          }
        }
        block[type].rich_text = splitRichText;
      }
      result.push(block);
    }

    return result;
  }

  async exportMarkdownToNotion(
    user: UserDocument,
    dto: ExportNotionDto,
  ): Promise<NotionExportResult> {
    if (user.isDemo) {
      throw new ForbiddenException(
        'Las integraciones con Notion no están disponibles en modo demo. Por favor, inicia sesión con GitHub.',
      );
    }

    // 1. Cargar documentación verificando que pertenece al usuario autenticado
    const doc = await this.docModel.findById(dto.documentationId).exec();
    if (!doc) {
      throw new NotFoundException('Documentación no encontrada');
    }

    if (doc.userId.toString() !== (user as any)._id.toString()) {
      throw new ForbiddenException('No tienes permiso para exportar esta documentación');
    }

    // 2. Obtener y descifrar el token de acceso de Notion del usuario
    const dbUser = await this.userModel
      .findById((user as any)._id)
      .select('+notion.accessTokenEnc')
      .exec();

    if (!dbUser?.notion?.accessTokenEnc) {
      throw new ConflictException(
        'NOTION_NOT_CONNECTED: No hay una cuenta de Notion vinculada. Conéctala en Configuración.',
      );
    }

    const encKey = this.configService.get<string>('githubTokenEncryptionKey');
    const accessToken = decryptToken(dbUser.notion.accessTokenEnc, encKey);

    const notion = new Client({ auth: accessToken });

    // 3. Determinar el título de la página
    let pageTitle = dto.title?.trim();
    if (!pageTitle) {
      const firstHeadingMatch = doc.content.match(/^#\s+(.+)$/m);
      if (firstHeadingMatch) {
        pageTitle = firstHeadingMatch[1].trim().slice(0, 200);
      } else {
        const repoName = doc.repoUrl.replace(/\/$/, '').split('/').pop() || 'Repo';
        pageTitle = `Documentación de ${repoName}`;
      }
    }

    // 4. Parsear Markdown a bloques de Notion con Martian y sanitizar límites de 2.000 caracteres
    let blocks: any[];
    try {
      blocks = markdownToBlocks(doc.content);
    } catch (parseError: any) {
      this.logger.error(`Error al parsear Markdown con Martian: ${parseError.message}`);
      throw new BadRequestException('Formato de contenido Markdown incompatible');
    }

    if (!Array.isArray(blocks) || blocks.length === 0) {
      blocks = [
        {
          object: 'block',
          type: 'paragraph',
          paragraph: { rich_text: [] },
        },
      ];
    }

    blocks = this.sanitizeBlocks(blocks);

    const initialBlocks = blocks.slice(0, 100);
    const remainingBlocks = blocks.slice(100);

    try {
      this.logger.log(
        `Creando página en Notion "${pageTitle}" en padre "${dto.targetPageId}" (${blocks.length} bloques totales)`,
      );

      const response = await notion.pages.create({
        parent: { page_id: dto.targetPageId },
        properties: {
          title: {
            title: [{ text: { content: pageTitle } }],
          },
        },
        children: initialBlocks,
      });

      // 5. Agregar bloques restantes en lotes de 100 con control de ritmo (~3 req/s)
      if (remainingBlocks.length > 0) {
        const chunkSize = 100;
        for (let i = 0; i < remainingBlocks.length; i += chunkSize) {
          const chunk = remainingBlocks.slice(i, i + chunkSize);

          // Pausa preventiva de 350ms para evitar rate limiting de Notion
          await new Promise((resolve) => setTimeout(resolve, 350));

          let retries = 3;
          while (retries > 0) {
            try {
              await notion.blocks.children.append({
                block_id: response.id,
                children: chunk,
              });
              break;
            } catch (appendErr: any) {
              if (
                isNotionClientError(appendErr) &&
                appendErr.code === APIErrorCode.RateLimited &&
                retries > 1
              ) {
                this.logger.warn('Rate limit de Notion alcanzado al agregar bloques. Reintentando...');
                await new Promise((resolve) => setTimeout(resolve, 2000));
                retries--;
              } else {
                throw appendErr;
              }
            }
          }
        }
      }

      const pageUrl =
        'url' in response && response.url
          ? response.url
          : `https://notion.so/${response.id.replace(/-/g, '')}`;

      this.logger.log(`Documentación exportada exitosamente a Notion: ${pageUrl}`);

      return {
        success: true,
        url: pageUrl,
      };
    } catch (error: any) {
      this.handleNotionError(error);
    }
  }

  private handleNotionError(error: any): never {
    this.logger.error(`Error en la API de Notion: ${error?.message}`, error?.stack);

    if (isNotionClientError(error)) {
      switch (error.code) {
        case APIErrorCode.Unauthorized:
          throw new BadRequestException(
            'El token de acceso de Notion no es válido o ha expirado. Por favor, vuelve a vincular tu cuenta.',
          );
        case APIErrorCode.RestrictedResource:
          throw new BadRequestException(
            'La integración no tiene permisos para escribir en la página destino indicada.',
          );
        case APIErrorCode.ObjectNotFound:
          throw new BadRequestException(
            'La página destino no fue encontrada. Asegúrate de haber compartido la página con CodeScribe (⋯ -> Conexiones).',
          );
        case APIErrorCode.RateLimited:
          throw new BadRequestException(
            'Se ha superado el límite de peticiones hacia Notion. Por favor, intenta de nuevo en unos minutos.',
          );
        default:
          throw new BadRequestException(
            `Error devuelto por la API de Notion [${error.code}]: ${error.message}`,
          );
      }
    }

    if (
      error instanceof BadRequestException ||
      error instanceof ForbiddenException ||
      error instanceof NotFoundException ||
      error instanceof ConflictException
    ) {
      throw error;
    }

    throw new InternalServerErrorException(
      `Error inesperado al exportar a Notion: ${error?.message || 'Error desconocido'}`,
    );
  }
}
