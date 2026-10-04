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
} from '@nestjs/common';
import { Observable, interval, switchMap, map, takeWhile, finalize } from 'rxjs';
import { Throttle } from '@nestjs/throttler';
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
   * Server-Sent Events endpoint — polls job status every 2s and pushes updates.
   * Closes the stream automatically when the job reaches a terminal state.
   */
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
    if (job.userId.toString() !== (user as any)._id.toString()) {
      throw new ForbiddenException('No tienes permiso para monitorear este trabajo');
    }

    return interval(2000).pipe(
      switchMap(() => this.jobsService.findById(id)),
      map((currentJob) => {
        if (!currentJob) {
          return {
            data: JSON.stringify({
              status: JobStatus.ERROR,
              progress: 0,
              errorMessage: 'El trabajo fue eliminado',
            }),
          };
        }
        return {
          data: JSON.stringify({
            status: currentJob.status ?? 'queued',
            progress: currentJob.progress ?? 0,
            documentationId: currentJob.documentationId,
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
      finalize(() => console.log(`[SSE] Stream closed for job ${id}`)),
    );
  }
}
