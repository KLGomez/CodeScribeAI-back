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

    this.logger.log(`Processing job ${jobId} → ${repoUrl}`);
    await this.jobsService.updateStatus(jobId, JobStatus.PROCESSING);

    try {
      const user = await this.usersService.findByIdWithToken(userId);
      const key = this.configService.get<string>('githubTokenEncryptionKey');
      const githubToken = decryptToken(user!.githubToken, key);

      const result = await this.aiGatewayService.analyze({
        repoUrl,
        githubToken,
        userId,
        jobId,
      });

      const doc = await this.documentationService.create({
        userId: new Types.ObjectId(userId),
        jobId: new Types.ObjectId(jobId),
        repoUrl,
        content: result.markdown,
        sections: result.sections,
        tokensUsed: result.tokensUsed,
      });

      await this.usersService.incrementAnalysisCount(userId);

      await this.jobsService.updateStatus(jobId, JobStatus.DONE, {
        documentationId: (doc as any)._id.toString(),
        tokensUsed: result.tokensUsed,
        durationMs: Date.now() - startTime,
        progress: 100,
      });

      this.logger.log(`Job ${jobId} completed in ${Date.now() - startTime}ms`);
    } catch (error: any) {
      this.logger.error(`Job ${jobId} failed: ${error.message}`);
      await this.jobsService.updateStatus(jobId, JobStatus.ERROR, {
        errorMessage: error.message,
      });
      throw error; // BullMQ will mark job as failed
    }
  }
}
