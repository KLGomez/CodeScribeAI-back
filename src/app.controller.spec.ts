import { Test, TestingModule } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import { AppController } from './app.controller.js';

describe('AppController', () => {
  let appController: AppController;

  const mockConnection = {
    readyState: 1,
  };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: getConnectionToken(),
          useValue: mockConnection,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return service info', () => {
      const res = appController.getHello();
      expect(res.message).toBe('CodeScribe AI Backend API');
      expect(res.service).toBe('documentador-backend');
    });
  });

  describe('health', () => {
    it('should report ok status when mongo is connected', () => {
      const health = appController.getHealth();
      expect(health.status).toBe('ok');
      expect(health.services.mongodb).toBe('connected');
    });

    it('should report degraded status when mongo is disconnected', () => {
      mockConnection.readyState = 0;
      const health = appController.getHealth();
      expect(health.status).toBe('degraded');
      expect(health.services.mongodb).toBe('disconnected');
      mockConnection.readyState = 1;
    });
  });
});
