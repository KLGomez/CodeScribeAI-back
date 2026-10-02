import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import {
  Documentation,
  DocumentationDocument,
} from '../documentation/schemas/documentation.schema';
import { Job, JobDocument } from '../jobs/schemas/job.schema';
import { ConfigService } from '@nestjs/config';
import { encryptToken } from '../../common/utils/crypto.util';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Documentation.name)
    private documentationModel: Model<DocumentationDocument>,
    @InjectModel(Job.name) private jobModel: Model<JobDocument>,
    private configService: ConfigService,
  ) {}

  async findOrCreate(profile: {
    githubId: string;
    username: string;
    displayName?: string;
    avatarUrl?: string;
    email?: string;
    accessToken: string;
  }): Promise<UserDocument> {
    const key = this.configService.get<string>('githubTokenEncryptionKey');
    const encryptedToken = encryptToken(profile.accessToken, key);

    return this.userModel.findOneAndUpdate(
      { githubId: profile.githubId },
      {
        $set: {
          username: profile.username,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
          email: profile.email,
          githubToken: encryptedToken,
        },
      },
      { upsert: true, new: true },
    );
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  /** Includes the encrypted githubToken field (excluded by default) */
  async findByIdWithToken(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).select('+githubToken').exec();
  }

  async incrementAnalysisCount(userId: string): Promise<UserDocument | null> {
    return this.userModel
      .findByIdAndUpdate(
        userId,
        { $inc: { analysisCount: 1 } },
        { new: true },
      )
      .exec();
  }

  /**
   * Elimina definitivamente la cuenta de un usuario y todos sus datos en cascada:
   * 1. Documentaciones generadas
   * 2. Trabajos (jobs) registrados
   * 3. Documento del usuario
   */
  async deleteAccount(userId: string): Promise<void> {
    try {
      const targetUserId = Types.ObjectId.isValid(userId)
        ? new Types.ObjectId(userId)
        : userId;

      // 1. Eliminar documentaciones generadas por el usuario
      await this.documentationModel
        .deleteMany({
          $or: [{ userId: targetUserId }, { userId }],
        })
        .exec();

      // 2. Eliminar trabajos (jobs) registrados del usuario
      await this.jobModel
        .deleteMany({
          $or: [{ userId: targetUserId }, { userId }],
        })
        .exec();

      // 3. Eliminar el documento del usuario
      const deletedUser = await this.userModel.findByIdAndDelete(userId).exec();
      if (!deletedUser) {
        throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
      }

      this.logger.log(
        `Cuenta del usuario ${userId} y sus datos asociados eliminados definitivamente.`,
      );
    } catch (error: any) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `Error al eliminar la cuenta del usuario ${userId}: ${error?.message}`,
        error?.stack,
      );
      throw new InternalServerErrorException(
        'Error al eliminar la cuenta y los datos asociados',
      );
    }
  }
}

