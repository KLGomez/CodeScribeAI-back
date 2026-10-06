import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  OnApplicationBootstrap,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { Job, JobDocument, JobStatus } from './schemas/job.schema';
import { UsersService } from '../users/users.service';
import { RedisService } from '../../common/redis/redis.service';

@Injectable()
export class JobsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @InjectModel(Job.name) private jobModel: Model<JobDocument>,
    @InjectQueue('analysis') private analysisQueue: Queue,
    private usersService: UsersService,
    private configService: ConfigService,
    private redisService: RedisService,
  ) {}

  /**
   * B-8: Al arrancar la aplicación, marca como 'error' los jobs que quedaron
   * en estado 'processing' por más de 10 minutos (interrupción de servidor o reinicio).
   */
  async onApplicationBootstrap() {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    try {
      const result = await this.jobModel.updateMany(
        {
          status: JobStatus.PROCESSING,
          updatedAt: { $lt: tenMinutesAgo },
        },
        {
          $set: {
            status: JobStatus.ERROR,
            errorCode: 'AI_UNAVAILABLE',
            errorMessage: 'El análisis fue interrumpido por reinicio o indisponibilidad del servicio',
          },
        },
      );
      if (result.modifiedCount > 0) {
        this.logger.warn(
          `B-8: Se marcaron ${result.modifiedCount} trabajos colgados en estado ERROR`,
        );
      }
    } catch (err: any) {
      this.logger.error(`Error al limpiar trabajos colgados en bootstrap: ${err.message}`);
    }
  }

  async create(userId: string, repoUrl: string): Promise<JobDocument> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // B-5: Verificaciones de cuotas para usuarios en Modo Demo
    if (user.isDemo) {
      const demoLimit = this.configService.get<number>('demo.analysisLimit', 2);
      if ((user.analysisCount ?? 0) >= demoLimit) {
        throw new ForbiddenException({
          errorCode: 'DEMO_LIMIT_REACHED',
          message: `Has alcanzado el límite de ${demoLimit} análisis para esta sesión de demostración. Por favor, inicia sesión con GitHub para continuar.`,
        });
      }

      // Verificación de tope diario global de análisis demo en Redis
      const dailyLimit = this.configService.get<number>('demo.dailyAnalysisLimit', 50);
      const today = new Date().toISOString().slice(0, 10);
      const dailyKey = `demo:daily_count:${today}`;

      const currentDailyStr = await this.redisService.get(dailyKey);
      const currentDaily = parseInt(currentDailyStr || '0', 10);

      if (currentDaily >= dailyLimit) {
        throw new ForbiddenException({
          errorCode: 'DEMO_LIMIT_REACHED',
          message:
            'Se ha alcanzado el límite diario global de análisis en modo demo. Por favor, inicia sesión con GitHub para continuar.',
        });
      }

      const newDailyCount = await this.redisService.incr(dailyKey);
      if (newDailyCount === 1) {
        await this.redisService.expire(dailyKey, 86400 * 2);
      }
    } else {
      // Verificación de cuota de plan gratuito
      const FREE_LIMIT = 5;
      if (user.plan === 'free' && (user.analysisCount ?? 0) >= FREE_LIMIT) {
        throw new ForbiddenException({
          errorCode: 'FREE_LIMIT_REACHED',
          message: `Has alcanzado el límite de ${FREE_LIMIT} análisis para el plan gratuito. Elimina análisis anteriores para liberar espacio o actualiza a Pro.`,
        });
      }
    }

    const job = await this.jobModel.create({
      userId: new Types.ObjectId(userId),
      repoUrl,
      status: JobStatus.QUEUED,
      stage: 'conectando',
      expiresAt: user.expiresAt, // Limpieza automática TTL si es usuario demo
    });

    // B-8: Opciones de cola con reintentos controlados, backoff y retención limpia
    await this.analysisQueue.add(
      'analyze-repo',
      {
        jobId: (job as any)._id.toString(),
        userId,
        repoUrl,
      },
      {
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 3000,
        },
        removeOnComplete: { age: 86400 * 7, count: 1000 },
        removeOnFail: { age: 86400 * 7, count: 1000 },
      },
    );

    return job;
  }

  async findById(id: string): Promise<JobDocument | null> {
    return this.jobModel.findById(id).exec();
  }

  async findByUser(userId: string): Promise<JobDocument[]> {
    return this.jobModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async updateStatus(
    id: string,
    status: JobStatus,
    extra: Partial<Job> = {},
  ): Promise<void> {
    await this.jobModel.updateOne({ _id: id }, { $set: { status, ...extra } });
  }
}
