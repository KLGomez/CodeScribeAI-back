import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const reflector = app.get(Reflector);

  // B-2: Configurar trust proxy para deteccion precisa de IP detras de proxies inversos
  const trustProxy = configService.get('trustProxy');
  if (trustProxy !== false && trustProxy !== undefined) {
    (app.getHttpAdapter().getInstance() as any).set('trust proxy', trustProxy);
  }

  // B-11: Limite global de payload para prevenir ataques DoS por cuerpos gigantes
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));

  app.use(helmet());

  app.enableCors({
    origin: configService.get<string>('frontendUrl'),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalGuards(new JwtAuthGuard(reflector));

  const port = configService.get<number>('port');
  await app.listen(port ?? 3001);
  logger.log(`🚀 Backend running at http://localhost:${port}/api`);
}

bootstrap();
