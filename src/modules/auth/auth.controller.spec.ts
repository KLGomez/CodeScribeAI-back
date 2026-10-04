import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';

describe('AuthController & B-6 Auth Code Exchange', () => {
  let controller: AuthController;

  const mockAuthService = {
    signToken: vi.fn().mockReturnValue('mock_jwt_token_12345'),
  };

  const mockUser: any = {
    _id: '66faef1234567890abcdef01',
    username: 'octocat',
    displayName: 'The Octocat',
    avatarUrl: 'https://avatars.githubusercontent.com/u/583231',
    email: 'octocat@github.com',
    plan: 'free',
    analysisCount: 0,
    isDemo: false,
  };

  const mockUsersService = {
    findById: vi.fn(),
    createDemoUser: vi.fn(),
  };

  const mockConfigService = {
    get: vi.fn().mockImplementation((key: string) => {
      if (key === 'frontendUrl') return 'https://codescribe.app';
      return null;
    }),
  };

  const redisStore = new Map<string, string>();
  const mockRedisService = {
    set: vi.fn().mockImplementation(async (key: string, val: string) => {
      redisStore.set(key, val);
    }),
    get: vi.fn().mockImplementation(async (key: string) => {
      return redisStore.get(key) || null;
    }),
    del: vi.fn().mockImplementation(async (key: string) => {
      const existed = redisStore.has(key);
      redisStore.delete(key);
      return existed ? 1 : 0;
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    redisStore.clear();

    controller = new AuthController(
      mockAuthService as any,
      mockUsersService as any,
      mockConfigService as any,
      mockRedisService as any,
    );
  });

  describe('githubCallback (B-6)', () => {
    it('debe generar un código de un solo uso, guardarlo en Redis y redirigir con ?code= sin JWT en la URL', async () => {
      const mockReq = { user: mockUser };
      const mockRes: any = { redirect: vi.fn() };

      await controller.githubCallback(mockReq, mockRes);

      expect(mockRedisService.set).toHaveBeenCalledTimes(1);
      const [key, userId, ttl] = mockRedisService.set.mock.calls[0];
      expect(key).toMatch(/^auth:code:[a-f0-9]{64}$/);
      expect(userId).toBe('66faef1234567890abcdef01');
      expect(ttl).toBe(60);

      expect(mockRes.redirect).toHaveBeenCalledTimes(1);
      const redirectUrl = mockRes.redirect.mock.calls[0][0];
      expect(redirectUrl).toMatch(/^https:\/\/codescribe\.app\/auth\/callback\?code=[a-f0-9]{64}$/);
      expect(redirectUrl).not.toContain('jwt=');
      expect(redirectUrl).not.toContain('token=');
    });
  });

  describe('exchangeCode (B-6)', () => {
    it('debe canjear un código válido por un JWT y eliminar inmediatamente el código de Redis', async () => {
      const code = 'valid_auth_code_123';
      redisStore.set(`auth:code:${code}`, '66faef1234567890abcdef01');
      mockUsersService.findById.mockResolvedValue(mockUser);

      const result = await controller.exchangeCode({ code });

      expect(result.token).toBe('mock_jwt_token_12345');
      expect(result.user.username).toBe('octocat');
      expect(mockRedisService.del).toHaveBeenCalledWith(`auth:code:${code}`);
      expect(redisStore.has(`auth:code:${code}`)).toBe(false);
    });

    it('debe fallar con UnauthorizedException si el código no existe o expiró', async () => {
      await expect(
        controller.exchangeCode({ code: 'non_existent_or_expired_code' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('debe fallar si se intenta reutilizar el mismo código una segunda vez', async () => {
      const code = 'reused_code_456';
      redisStore.set(`auth:code:${code}`, '66faef1234567890abcdef01');
      mockUsersService.findById.mockResolvedValue(mockUser);

      // Primer canje: exitoso
      await controller.exchangeCode({ code });

      // Segundo canje: debe fallar con 401
      await expect(controller.exchangeCode({ code })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('debe fallar si el usuario asociado al código ya no existe en base de datos', async () => {
      const code = 'orphan_code_789';
      redisStore.set(`auth:code:${code}`, 'non_existent_user_id');
      mockUsersService.findById.mockResolvedValue(null);

      await expect(controller.exchangeCode({ code })).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('demoLogin (B-5)', () => {
    it('debe crear un usuario demo efímero con isDemo: true, expiresAt y retornar token', async () => {
      const demoUser = {
        _id: 'demo_user_123',
        username: 'demo_abc123',
        displayName: 'Usuario Demo (abc123)',
        avatarUrl: 'https://avatars.githubusercontent.com/u/9919?s=200&v=4',
        email: 'demo_abc123@codescribe.local',
        plan: 'free',
        analysisCount: 0,
        isDemo: true,
      };
      mockUsersService.createDemoUser.mockResolvedValue(demoUser);

      const result = await controller.demoLogin();

      expect(result.token).toBe('mock_jwt_token_12345');
      expect(result.user.isDemo).toBe(true);
      expect(mockUsersService.createDemoUser).toHaveBeenCalledTimes(1);
      const createArgs = mockUsersService.createDemoUser.mock.calls[0][0];
      expect(createArgs.expiresAt).toBeInstanceOf(Date);
      // Validar que expire en aproximadamente 24 horas
      const diffHours = (createArgs.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60);
      expect(diffHours).toBeGreaterThan(23.9);
      expect(diffHours).toBeLessThanOrEqual(24);
    });
  });
});
