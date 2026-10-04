import {
  Controller,
  Get,
  Delete,
  Param,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DocumentationService } from './documentation.service';
import { UserDocument } from '../users/schemas/user.schema';

@Controller(['documentation', 'docs'])
@UseGuards(JwtAuthGuard)
export class DocumentationController {
  constructor(private docService: DocumentationService) {}

  /**
   * GET /docs o GET /documentation
   * Filtra obligatoriamente los resultados buscando solo los documentos
   * donde userId coincide con el del usuario autenticado en el token JWT.
   */
  @Get()
  findAll(@CurrentUser() user: UserDocument) {
    if (!user || !(user as any)._id) {
      throw new UnauthorizedException('Token de autenticación inválido o ausente');
    }
    const userId = (user as any)._id.toString();
    return this.docService.findByUser(userId);
  }

  /**
   * GET /docs/:id o GET /documentation/:id
   * Obtiene un documento verificando que pertenezca al usuario del token.
   */
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: UserDocument) {
    if (!user || !(user as any)._id) {
      throw new UnauthorizedException('Usuario no autenticado');
    }
    const userId = (user as any)._id.toString();
    return this.docService.findById(id, userId);
  }

  /**
   * DELETE /docs/:id o DELETE /documentation/:id
   * Endpoint de eliminación física definitiva con verificación estricta de pertenencia (403 Forbidden).
   */
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: UserDocument) {
    if (!user || !(user as any)._id) {
      throw new UnauthorizedException('Usuario no autenticado');
    }
    const userId = (user as any)._id.toString();
    return this.docService.delete(id, userId);
  }
}
