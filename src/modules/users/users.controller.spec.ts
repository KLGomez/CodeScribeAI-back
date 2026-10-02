import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UsersController } from './users.controller';
import { UnauthorizedException } from '@nestjs/common';
import { Types } from 'mongoose';

describe('UsersController - deleteAccount', () => {
  let controller: UsersController;
  let mockUsersService: any;

  const userId = new Types.ObjectId().toString();

  beforeEach(() => {
    mockUsersService = {
      deleteAccount: vi.fn().mockResolvedValue(undefined),
    };

    controller = new UsersController(mockUsersService);
  });

  it('debe llamar a usersService.deleteAccount y retornar status 200 con mensaje de éxito', async () => {
    const mockUser = {
      _id: new Types.ObjectId(userId),
      username: 'johndoe',
      displayName: 'John Doe',
      email: 'john@example.com',
    };

    const response = await controller.deleteAccount(mockUser);

    expect(mockUsersService.deleteAccount).toHaveBeenCalledWith(userId);
    expect(response).toEqual({
      success: true,
      message: 'Cuenta y datos asociados eliminados definitivamente',
    });
  });

  it('debe lanzar UnauthorizedException si no hay usuario autenticado', async () => {
    await expect(controller.deleteAccount(null)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('debe lanzar UnauthorizedException si el usuario no tiene ID', async () => {
    await expect(controller.deleteAccount({})).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
