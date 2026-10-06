import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Sse,
  UseGuards,
  MessageEvent,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Observable, interval, switchMap, map, takeWhile, finalize } from 'rxjs';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { Types } from 'mongoose';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JobsService } from './jobs.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UserDocument } from '../users/schemas/user.schema';
import { JobStatus } from './schemas/job.schema';

@Controller('jobs')
@UseGuards(JwtAuthGuard)
export class JobsController {
  private readonly logger = new Logger(JobsController.name);
  private activeStreamsByUser = new Map<string, number>();

  constructor(private readonly jobsService: JobsService) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post()
  create(@Body() dto: CreateJobDto, @CurrentUser() user: UserDocument) {
    return this.jobsService.create((user as any)._id.toString(), dto.repoUrl);
  }

  @Get()
  findAll(@CurrentUser() user: UserDocument) {
    return this.jobsService.findByUser((user as any)._id.toString());
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: UserDocument) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Formato de ID de trabajo inválido');
    }
    const job = await this.jobsService.findById(id);
    if (!job) {
      throw new NotFoundException('Trabajo no encontrado');
    }
    if (job.userId.toString() !== (user as any)._id.toString()) {
      throw new ForbiddenException('No tienes permiso para ver este trabajo');
    }
    return job;
  }

  /**
   * B-7: Server-Sent Events endpoint autenticado por header Bearer.
   * Emite status, progress, stage, documentationId, errorCode y errorMessage cada 2s.
   * Limita a 3 streams simultáneos por usuario y cierra limpiamente la conexión.
   */
  @SkipThrottle()
  @Sse(':id/stream')
  async stream(
    @Param('id') id: string,
    @CurrentUser() user: UserDocument,
  ): Promise<Observable<MessageEvent>> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Formato de ID de trabajo inválido');
    }
    const job = await this.jobsService.findById(id);
    if (!job) {
      throw new NotFoundException('Trabajo no encontrado');
    }
    const userId = (user as any)._id.toString();
    if (job.userId.toString() !== userId) {
      throw new ForbiddenException('No tienes permiso para monitorear este trabajo');
    }

    // Límite de 3 streams simultáneos por usuario
    const active = this.activeStreamsByUser.get(userId) || 0;
    if (active >= 3) {
      throw new ForbiddenException('Has alcanzado el límite de 3 conexiones de streaming simultáneas');
    }
    this.activeStreamsByUser.set(userId, active + 1);

    return interval(2000).pipe(
      switchMap(() => this.jobsService.findById(id)),
      map((currentJob) => {
        if (!currentJob) {
          return {
            data: JSON.stringify({
              status: JobStatus.ERROR,
              progress: 0,
              stage: 'error',
              errorCode: 'JOB_NOT_FOUND',
              errorMessage: 'El trabajo fue eliminado',
            }),
          };
        }
        return {
          data: JSON.stringify({
            status: currentJob.status ?? 'queued',
            progress: currentJob.progress ?? 0,
            stage: currentJob.stage ?? 'conectando',
            documentationId: currentJob.documentationId,
            errorCode: currentJob.errorCode,
            errorMessage: currentJob.errorMessage,
          }),
        };
      }),
      takeWhile(
        (event) => {
          const { status } = JSON.parse(event.data as string);
          return status !== JobStatus.DONE && status !== JobStatus.ERROR;
        },
        true, // emit the terminal event before completing
      ),
      finalize(() => {
        const count = (this.activeStreamsByUser.get(userId) || 1) - 1;
        if (count <= 0) {
          this.activeStreamsByUser.delete(userId);
        } else {
          this.activeStreamsByUser.set(userId, count);
        }
        this.logger.log(`[SSE] Stream cerrado limpiamente para job ${id} (usuario ${userId})`);
      }),
    );
  }
}
