import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RepositoryController } from './repository.controller';
import { RepositoryService } from './repository.service';
import { Repository, RepositorySchema } from './schemas/repository.schema';
import { JobsModule } from '../jobs/jobs.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Repository.name, schema: RepositorySchema },
    ]),
    JobsModule,
  ],
  controllers: [RepositoryController],
  providers: [RepositoryService],
})
export class RepositoryModule {}
