import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job as BullJob } from 'bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobsService } from './jobs.service';
import { JobStatus } from './schemas/job.schema';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { DocumentationService } from '../documentation/documentation.service';
import { UsersService } from '../users/users.service';
import { decryptToken } from '../../common/utils/crypto.util';
import { Types } from 'mongoose';

interface AnalysisJobData {
  jobId: string;
  userId: string;
  repoUrl: string;
}

@Processor('analysis')
export class JobsProcessor extends WorkerHost {
  private readonly logger = new Logger(JobsProcessor.name);

  constructor(
    private jobsService: JobsService,
    private aiGatewayService: AiGatewayService,
    private documentationService: DocumentationService,
    private usersService: UsersService,
    private configService: ConfigService,
  ) {
    super();
  }

  async process(job: BullJob<AnalysisJobData>): Promise<void> {
    const { jobId, userId, repoUrl } = job.data;
    const startTime = Date.now();

    this.logger.log(`Iniciando procesamiento de job ${jobId} para ${repoUrl}`);

    // Etapa 1: Conectando y validando credenciales
    await this.jobsService.updateStatus(jobId, JobStatus.PROCESSING, {
      progress: 15,
      stage: 'conectando',
    });

    try {
      const user = await this.usersService.findByIdWithToken(userId);
      if (!user) {
        throw new Error('Usuario asociado al trabajo no encontrado');
      }

      const key = this.configService.get<string>('githubTokenEncryptionKey');
      const githubToken = user.githubToken ? decryptToken(user.githubToken, key) : '';

      // Etapa 2: Leyendo repositorio con Git Trees API
      await this.jobsService.updateStatus(jobId, JobStatus.PROCESSING, {
        progress: 40,
        stage: 'leyendo_repositorio',
      });

      const result = await this.aiGatewayService.analyze({
        repoUrl,
        githubToken,
        userId,
        jobId,
      });

      // Etapa 3: Generando documentación con Gemini
      await this.jobsService.updateStatus(jobId, JobStatus.PROCESSING, {
        progress: 85,
        stage: 'generando_documentacion',
      });

      // Etapa 4: Guardando documentación
      await this.jobsService.updateStatus(jobId, JobStatus.PROCESSING, {
        progress: 95,
        stage: 'guardando',
      });

      const doc = await this.documentationService.create({
        userId: new Types.ObjectId(userId),
        jobId: new Types.ObjectId(jobId),
        repoUrl,
        content: result.markdown,
        sections: result.sections,
        tokensUsed: result.tokensUsed,
        filesAnalyzed: result.filesAnalyzed ?? 0,
        filesTotal: result.filesTotal ?? 0,
        truncated: result.truncated ?? false,
        expiresAt: user.expiresAt, // Limpieza automática TTL si es usuario demo
      });

      await this.usersService.incrementAnalysisCount(userId);

      await this.jobsService.updateStatus(jobId, JobStatus.DONE, {
        documentationId: (doc as any)._id.toString(),
        tokensUsed: result.tokensUsed,
        durationMs: Date.now() - startTime,
        progress: 100,
        stage: 'completado',
      });

      this.logger.log(
        `Job ${jobId} completado exitosamente en ${Date.now() - startTime}ms`,
      );
    } catch (error: any) {
      this.logger.error(`Error en procesamiento de job ${jobId}: ${error.message}`);

      let errorCode = 'AI_UNAVAILABLE';
      let errorMessage =
        'El servicio de análisis no está disponible temporalmente. Por favor, reintenta más tarde.';

      // Mapear respuestas tipificadas del motor de IA
      const detail = error?.response?.data?.detail;
      if (detail && typeof detail === 'object') {
        errorCode = detail.code || errorCode;
        errorMessage = detail.message || errorMessage;
      } else if (typeof detail === 'string') {
        errorMessage = detail;
      } else if (error?.status === 429 || error?.response?.status === 429) {
        errorCode = 'GITHUB_RATE_LIMIT';
        errorMessage =
          'GitHub ha limitado temporalmente las consultas. Por favor, espera unos minutos o inicia sesión con tu cuenta.';
      } else if (error?.status === 404 || error?.response?.status === 404) {
        errorCode = 'REPO_NOT_FOUND';
        errorMessage =
          'El repositorio solicitado no existe o no tienes permisos para acceder a él.';
      } else if (error?.status === 422 || error?.response?.status === 422) {
        errorCode = 'REPO_EMPTY';
        errorMessage = 'El repositorio está vacío o no contiene código fuente válido para analizar.';
      } else if (
        error?.code === 'ECONNABORTED' ||
        error?.message?.toLowerCase().includes('timeout')
      ) {
        errorCode = 'AI_TIMEOUT';
        errorMessage = 'El tiempo de espera para generar la documentación ha expirado.';
      }

      await this.jobsService.updateStatus(jobId, JobStatus.ERROR, {
        errorCode,
        errorMessage,
      });

      throw error;
    }
  }
}
