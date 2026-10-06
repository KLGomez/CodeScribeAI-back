import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserDocument } from '../users/schemas/user.schema';
import {
  NotionIntegrationService,
  NotionPageSummary,
} from './notion-integration.service';
import { NotionCallbackDto } from './dto/notion-callback.dto';

@ApiTags('Integrations - Notion')
@ApiBearerAuth()
@Controller('integrations/notion')
@UseGuards(JwtAuthGuard)
@Throttle({ default: { limit: 10, ttl: 60000 } })
export class NotionIntegrationController {
  constructor(
    private readonly notionIntegrationService: NotionIntegrationService,
  ) {}

  @Get('auth-url')
  @ApiOperation({ summary: 'Obtener URL de autorización OAuth de Notion con state firmado' })
  getAuthUrl(@CurrentUser() user: UserDocument) {
    return this.notionIntegrationService.getAuthUrl(user);
  }

  @Post('callback')
  @ApiOperation({ summary: 'Canjear código de autorización OAuth por token de Notion' })
  handleCallback(
    @CurrentUser() user: UserDocument,
    @Body() dto: NotionCallbackDto,
  ) {
    return this.notionIntegrationService.handleCallback(user, dto);
  }

  @Get('status')
  @ApiOperation({ summary: 'Verificar si el usuario tiene una cuenta de Notion conectada' })
  getStatus(@CurrentUser() user: UserDocument) {
    return this.notionIntegrationService.getStatus(user);
  }

  @Get('pages')
  @ApiOperation({ summary: 'Listar páginas de Notion compartidas con la integración' })
  getPages(@CurrentUser() user: UserDocument): Promise<NotionPageSummary[]> {
    return this.notionIntegrationService.getPages(user);
  }

  @Delete()
  @ApiOperation({ summary: 'Desconectar la integración con Notion eliminando las credenciales' })
  disconnect(@CurrentUser() user: UserDocument) {
    return this.notionIntegrationService.disconnect(user);
  }
}
