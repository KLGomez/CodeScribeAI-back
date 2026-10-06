import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Documentation,
  DocumentationDocument,
} from './schemas/documentation.schema';
@Injectable()
export class DocumentationService {
  private readonly logger = new Logger(DocumentationService.name);

  constructor(
    @InjectModel(Documentation.name)
    private docModel: Model<DocumentationDocument>,
  ) {}

  /**
   * Guarda un documento en MongoDB asignando obligatoriamente el userId autenticado
   */
  async create(data: Partial<Documentation>): Promise<DocumentationDocument> {
    if (!data.userId) {
      throw new BadRequestException('El campo userId es obligatorio para guardar la documentación');
    }

    const payload = {
      ...data,
      userId: new Types.ObjectId(data.userId.toString()),
      jobId: data.jobId ? new Types.ObjectId(data.jobId.toString()) : undefined,
    };

    return this.docModel.create(payload);
  }

  /**
   * Obtiene una documentación por su ID garantizando la verificación de propiedad
   */
  async findById(id: string, userId: string): Promise<DocumentationDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Identificador de documentación inválido');
    }

    const doc = await this.docModel.findById(id).exec();
    if (!doc) {
      throw new NotFoundException('Documentación no encontrada');
    }

    // Regla de seguridad: verificar que el documento pertenezca al usuario del token
    if (doc.userId.toString() !== userId.toString()) {
      throw new ForbiddenException('No tienes autorización para acceder a esta documentación');
    }

    return doc;
  }

  /**
   * Obtiene obligatoriamente solo los documentos creados por el usuario autenticado
   */
  async findByUser(userId: string): Promise<DocumentationDocument[]> {
    if (!userId || !Types.ObjectId.isValid(userId)) {
      throw new UnauthorizedException('Identificador de usuario inválido o no autenticado');
    }

    return this.docModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .select('-content') // omite el contenido pesado para optimizar la carga del listado
      .exec();
  }

  /**
   * Elimina de forma física y definitiva un documento tras verificar la pertenencia,
   * y despacha la señal de limpieza al microservicio de Python.
   */
  async delete(id: string, userId: string): Promise<{ success: boolean; message: string }> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Identificador de documentación inválido');
    }

    // 1. Verificar existencia del documento
    const doc = await this.docModel.findById(id).exec();
    if (!doc) {
      throw new NotFoundException('La documentación solicitada no existe');
    }

    // 2. Regla de seguridad estricta: verificar que userId coincida con el JWT
    if (doc.userId.toString() !== userId.toString()) {
      this.logger.warn(
        `Intento de eliminación no autorizada: Usuario ${userId} intentó borrar documento ${id} perteneciente a ${doc.userId}`,
      );
      throw new ForbiddenException('No tienes permiso para eliminar esta documentación');
    }

    // 3. Borrado Físico Definitivo en MongoDB (sin borrado lógico)
    await this.docModel.findByIdAndDelete(id).exec();
    this.logger.log(`Documentación ${id} eliminada físicamente de MongoDB por usuario ${userId}`);

    return {
      success: true,
      message: 'Documentación eliminada permanentemente',
    };
  }
}
