import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RepositoryModule } from './modules/repository/repository.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { DocumentationModule } from './modules/documentation/documentation.module';
import { AiGatewayModule } from './modules/ai-gateway/ai-gateway.module';
import { NotionExportModule } from './modules/notion-export/notion-export.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => [
        {
          ttl: cfg.get<number>('throttle.ttl') * 1000,
          limit: cfg.get<number>('throttle.limit'),
        },
      ],
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        connection: {
          host: cfg.get<string>('redis.host'),
          port: cfg.get<number>('redis.port'),
        },
      }),
    }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    RepositoryModule,
    JobsModule,
    DocumentationModule,
    AiGatewayModule,
    NotionExportModule,
  ],
})
export class AppModule {}
