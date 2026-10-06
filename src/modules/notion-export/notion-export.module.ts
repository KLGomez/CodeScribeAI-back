import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { NotionExportController } from './notion-export.controller';
import { NotionIntegrationController } from './notion-integration.controller';
import { NotionExportService } from './notion-export.service';
import { NotionIntegrationService } from './notion-integration.service';
import { User, UserSchema } from '../users/schemas/user.schema';
import {
  Documentation,
  DocumentationSchema,
} from '../documentation/schemas/documentation.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Documentation.name, schema: DocumentationSchema },
    ]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.get<string>('jwt.secret'),
        signOptions: { expiresIn: '10m' },
      }),
    }),
  ],
  controllers: [NotionExportController, NotionIntegrationController],
  providers: [NotionExportService, NotionIntegrationService],
  exports: [NotionExportService, NotionIntegrationService],
})
export class NotionExportModule {}
