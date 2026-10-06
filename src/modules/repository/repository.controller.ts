import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JobsService } from '../jobs/jobs.service';
import { RepositoryService } from './repository.service';
import { AnalyzeRepoDto } from './dto/analyze-repo.dto';
import { UserDocument } from '../users/schemas/user.schema';

@Controller('repositories')
@UseGuards(JwtAuthGuard)
export class RepositoryController {
  constructor(
    private repoService: RepositoryService,
    private jobsService: JobsService,
  ) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('analyze')
  async analyze(
    @Body() dto: AnalyzeRepoDto,
    @CurrentUser() user: UserDocument,
  ) {
    const userId = (user as any)._id.toString();
    await this.repoService.findOrCreate(userId, dto.repoUrl);
    const job = await this.jobsService.create(userId, dto.repoUrl);
    return { jobId: (job as any)._id, status: job.status };
  }
}
