import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { Public } from './common/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(
    @InjectConnection() private readonly mongoConnection: Connection,
  ) {}

  @Public()
  @Get()
  getHello(): { message: string; service: string; version: string } {
    return {
      message: 'CodeScribe AI Backend API',
      service: 'documentador-backend',
      version: '1.0.0',
    };
  }

  @Public()
  @Get('health')
  getHealth(): {
    status: string;
    timestamp: string;
    services: {
      mongodb: string;
    };
  } {
    const isMongoOk = this.mongoConnection.readyState === 1;
    return {
      status: isMongoOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        mongodb: isMongoOk ? 'connected' : 'disconnected',
      },
    };
  }
}
