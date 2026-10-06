import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Client, isNotionClientError, APIErrorCode } from '@notionhq/client';
import * as crypto from 'crypto';
import { User, UserDocument } from '../users/schemas/user.schema';
import { encryptToken, decryptToken } from '../../common/utils/crypto.util';
import { NotionCallbackDto } from './dto/notion-callback.dto';

export interface NotionPageSummary {
  id: string;
  title: string;
  icon?: string;
}

@Injectable()
export class NotionIntegrationService {
  private readonly logger = new Logger(NotionIntegrationService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private configService: ConfigService,
    private jwtService: JwtService,
  ) {}

  async getAuthUrl(user: UserDocument): Promise<{ url: string }> {
    if (user.isDemo) {
      throw new ForbiddenException(
        'Las integraciones con Notion no están disponibles en modo demo. Por favor, inicia sesión con GitHub.',
      );
    }

    const clientId = this.configService.get<string>('notion.clientId');
    const redirectUri = this.configService.get<string>('notion.redirectUri');

    if (!clientId || !redirectUri) {
      throw new BadRequestException('Configuración de Notion OAuth incompleta');
    }

    const state = this.jwtService.sign(
      {
        sub: (user as any)._id.toString(),
        purpose: 'notion-oauth',
        nonce: crypto.randomBytes(16).toString('hex'),
      },
      { expiresIn: '10m' },
    );

    const url = `https://api.notion.com/v1/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri,
    )}&response_type=code&owner=user&state=${state}`;

    return { url };
  }

  async handleCallback(
    user: UserDocument,
    dto: NotionCallbackDto,
  ): Promise<{ connected: boolean; workspaceName?: string }> {
    if (user.isDemo) {
      throw new ForbiddenException(
        'Las integraciones con Notion no están disponibles en modo demo.',
      );
    }

    let payload: any;
    try {
      payload = this.jwtService.verify(dto.state);
    } catch {
      throw new BadRequestException('Parámetro state inválido o expirado');
    }

    if (
      payload.purpose !== 'notion-oauth' ||
      payload.sub !== (user as any)._id.toString()
    ) {
      throw new BadRequestException(
        'El parámetro state no coincide con el usuario autenticado (posible ataque CSRF)',
      );
    }

    const clientId = this.configService.get<string>('notion.clientId');
    const clientSecret = this.configService.get<string>('notion.clientSecret');
    const redirectUri = this.configService.get<string>('notion.redirectUri');
    const encKey = this.configService.get<string>('githubTokenEncryptionKey');

    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    try {
      const response = await fetch('https://api.notion.com/v1/oauth/token', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code: dto.code,
          redirect_uri: redirectUri,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new BadRequestException(
          `Error en la autenticación con Notion: ${data.message || data.error || 'Código inválido'}`,
        );
      }

      const accessTokenEnc = encryptToken(data.access_token, encKey);

      await this.userModel.updateOne(
        { _id: (user as any)._id },
        {
          $set: {
            notion: {
              accessTokenEnc,
              workspaceName: data.workspace_name,
              workspaceId: data.workspace_id,
              botId: data.bot_id,
              connectedAt: new Date(),
            },
          },
        },
      );

      this.logger.log(
        `Usuario ${(user as any)._id} vinculó exitosamente su espacio de trabajo de Notion "${data.workspace_name}"`,
      );

      return {
        connected: true,
        workspaceName: data.workspace_name,
      };
    } catch (error: any) {
      if (error instanceof BadRequestException || error instanceof ForbiddenException) {
        throw error;
      }
      this.logger.error(`Error al conectar con Notion: ${error.message}`);
      throw new BadRequestException(
        `No se pudo completar la conexión con Notion: ${error.message}`,
      );
    }
  }

  async getStatus(user: UserDocument): Promise<{ connected: boolean; workspaceName: string | null }> {
    if (user.isDemo) {
      return { connected: false, workspaceName: null };
    }

    const dbUser = await this.userModel
      .findById((user as any)._id)
      .select('+notion.accessTokenEnc')
      .exec();

    const isConnected = Boolean(dbUser?.notion?.accessTokenEnc);
    return {
      connected: isConnected,
      workspaceName: isConnected ? dbUser?.notion?.workspaceName || null : null,
    };
  }

  async getPages(user: UserDocument): Promise<NotionPageSummary[]> {
    if (user.isDemo) {
      throw new ForbiddenException(
        'Las integraciones con Notion no están disponibles en modo demo.',
      );
    }

    const dbUser = await this.userModel
      .findById((user as any)._id)
      .select('+notion.accessTokenEnc')
      .exec();

    if (!dbUser?.notion?.accessTokenEnc) {
      throw new ConflictException('NOTION_NOT_CONNECTED: No hay cuenta de Notion conectada');
    }

    const encKey = this.configService.get<string>('githubTokenEncryptionKey');
    const token = decryptToken(dbUser.notion.accessTokenEnc, encKey);

    const notion = new Client({ auth: token });

    try {
      const searchRes = await notion.search({
        filter: { value: 'page', property: 'object' },
        page_size: 100,
      });

      return searchRes.results
        .filter((item: any) => item.object === 'page')
        .map((page: any) => {
          let title = 'Sin título';
          if (page.properties) {
            for (const key of Object.keys(page.properties)) {
              const prop = page.properties[key];
              if (prop.type === 'title' && prop.title && prop.title.length > 0) {
                title = prop.title.map((t: any) => t.plain_text).join('');
                break;
              }
            }
          }

          let icon: string | undefined = undefined;
          if (page.icon?.type === 'emoji') {
            icon = page.icon.emoji;
          }

          return {
            id: page.id,
            title: title || 'Sin título',
            icon,
          };
        });
    } catch (error: any) {
      if (isNotionClientError(error) && error.code === APIErrorCode.Unauthorized) {
        this.logger.warn(`Token de Notion revocado para usuario ${(user as any)._id}. Limpiando credenciales.`);
        await this.userModel.updateOne({ _id: (user as any)._id }, { $unset: { notion: 1 } });
        throw new UnauthorizedException({
          errorCode: 'NOTION_RECONNECT_REQUIRED',
          message:
            'La sesión de Notion ha expirado o el acceso fue revocado. Por favor, vuelve a conectar tu cuenta de Notion.',
        });
      }
      throw error;
    }
  }

  async disconnect(user: UserDocument): Promise<{ success: boolean }> {
    await this.userModel.updateOne(
      { _id: (user as any)._id },
      { $unset: { notion: 1 } },
    );
    this.logger.log(`Usuario ${(user as any)._id} desconectó su integración con Notion`);
    return { success: true };
  }
}
