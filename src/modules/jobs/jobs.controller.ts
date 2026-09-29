import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Sse,
  UseGuards,
  MessageEvent,
} from '@nestjs/common';
import { Observable, interval, switchMap, map, takeWhile, finalize } from 'rxjs';
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

  @Post()
  create(@Body() dto: CreateJobDto, @CurrentUser() user: UserDocument) {
    return this.jobsService.create((user as any)._id.toString(), dto.repoUrl);
  }

  @Get()
  findAll(@CurrentUser() user: UserDocument) {
    return this.jobsService.findByUser((user as any)._id.toString());
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.jobsService.findById(id);
  }

  /**
   * Server-Sent Events endpoint — polls job status every 2s and pushes updates.
   * Closes the stream automatically when the job reaches a terminal state.
   */
  @Sse(':id/stream')
  stream(@Param('id') id: string): Observable<MessageEvent> {
    return interval(2000).pipe(
      switchMap(() => this.jobsService.findById(id)),
      map((job) => ({
        data: JSON.stringify({
          status: job?.status ?? 'queued',
          progress: job?.progress ?? 0,
          documentationId: job?.documentationId,
          errorMessage: job?.errorMessage,
        }),
      })),
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
