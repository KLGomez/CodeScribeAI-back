import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { JobsProcessor } from './jobs.processor';
import { Job, JobSchema } from './schemas/job.schema';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';
import { DocumentationModule } from '../documentation/documentation.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Job.name, schema: JobSchema }]),
    BullModule.registerQueue({ name: 'analysis' }),
    AiGatewayModule,
    DocumentationModule,
    UsersModule,
  ],
  providers: [JobsService, JobsProcessor],
  controllers: [JobsController],
  exports: [JobsService],
})
export class JobsModule {}
