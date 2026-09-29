import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export interface AnalyzeRequest {
  repoUrl: string;
  githubToken: string;
  userId: string;
  jobId: string;
}

export interface AnalyzeResponse {
  markdown: string;
  tokensUsed: number;
  durationMs: number;
  sections: string[];
}

@Injectable()
export class AiGatewayService {
  private readonly logger = new Logger(AiGatewayService.name);
  private readonly MAX_RETRIES = 3;

  constructor(
    private httpService: HttpService,
    private configService: ConfigService,
  ) {}

  async analyze(request: AnalyzeRequest): Promise<AnalyzeResponse> {
    const url = this.configService.get<string>('aiService.url');
    const secret = this.configService.get<string>('aiService.secret');

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        this.logger.log(
          `[attempt ${attempt}] Calling AI Service for job ${request.jobId}`,
        );
        const { data } = await firstValueFrom(
          this.httpService.post<AnalyzeResponse>(`${url}/analyze`, request, {
            headers: { 'X-Internal-Secret': secret },
            timeout: 360_000, // 6 min — generous for large repos
          }),
        );
        return data;
      } catch (error: any) {
        this.logger.warn(
          `Attempt ${attempt} failed: ${error?.message ?? 'unknown'}`,
        );
        if (attempt === this.MAX_RETRIES) {
          throw new HttpException(
            `AI Service unavailable after ${this.MAX_RETRIES} retries`,
            HttpStatus.SERVICE_UNAVAILABLE,
          );
        }
        // Exponential backoff: 2s, 4s, 8s
        await new Promise((r) => setTimeout(r, 2 ** attempt * 1000));
      }
    }
  }
}
