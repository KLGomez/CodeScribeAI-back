import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UsersService } from './users.service';
import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';

describe('UsersService - deleteAccount', () => {
  let service: UsersService;
  let mockUserModel: any;
  let mockDocumentationModel: any;
  let mockJobModel: any;
  let mockConfigService: any;

  const userId = new Types.ObjectId().toString();

  beforeEach(() => {
    mockUserModel = {
      findById: vi.fn(),
      findByIdAndDelete: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue({ _id: userId, username: 'testuser' }),
      }),
      findOneAndUpdate: vi.fn(),
    };

    mockDocumentationModel = {
      deleteMany: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue({ deletedCount: 2 }),
      }),
    };

    mockJobModel = {
      deleteMany: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue({ deletedCount: 3 }),
      }),
    };

    mockConfigService = {
      get: vi.fn(),
    };

    service = new UsersService(
      mockUserModel,
      mockDocumentationModel,
      mockJobModel,
      mockConfigService,
    );
  });

  it('debe ejecutar la eliminación en cascada en el orden correcto (documentación, jobs, usuario)', async () => {
    const callOrder: string[] = [];

    mockDocumentationModel.deleteMany.mockImplementation(() => {
      callOrder.push('documentation');
      return { exec: vi.fn().mockResolvedValue({ deletedCount: 1 }) };
    });

    mockJobModel.deleteMany.mockImplementation(() => {
      callOrder.push('job');
      return { exec: vi.fn().mockResolvedValue({ deletedCount: 1 }) };
    });

    mockUserModel.findByIdAndDelete.mockImplementation(() => {
      callOrder.push('user');
      return { exec: vi.fn().mockResolvedValue({ _id: userId }) };
    });

    await service.deleteAccount(userId);

    expect(callOrder).toEqual(['documentation', 'job', 'user']);
    expect(mockDocumentationModel.deleteMany).toHaveBeenCalled();
    expect(mockJobModel.deleteMany).toHaveBeenCalled();
    expect(mockUserModel.findByIdAndDelete).toHaveBeenCalledWith(userId);
  });

  it('debe lanzar NotFoundException si el usuario no existe', async () => {
    mockUserModel.findByIdAndDelete.mockReturnValue({
      exec: vi.fn().mockResolvedValue(null),
    });

    await expect(service.deleteAccount(userId)).rejects.toThrow(NotFoundException);
  });

  it('debe lanzar InternalServerErrorException si la eliminación de documentación falla', async () => {
    mockDocumentationModel.deleteMany.mockImplementation(() => {
      throw new Error('Database connection failed');
    });

    await expect(service.deleteAccount(userId)).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('debe lanzar InternalServerErrorException si la eliminación de jobs falla', async () => {
    mockJobModel.deleteMany.mockImplementation(() => {
      throw new Error('Database error');
    });

    await expect(service.deleteAccount(userId)).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
