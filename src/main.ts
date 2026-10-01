import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const reflector = app.get(Reflector);

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
  console.log(`🚀 Backend running at http://localhost:${port}/api`);
}

bootstrap();
