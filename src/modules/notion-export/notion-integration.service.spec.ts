import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { NotionIntegrationService } from './notion-integration.service';
import { Client } from '@notionhq/client';
import { encryptToken, decryptToken } from '../../common/utils/crypto.util';

vi.mock('@notionhq/client', () => {
  const mockSearch = vi.fn();

  class MockClient {
    search = mockSearch;
  }

  return {
    Client: MockClient,
    isNotionClientError: (err: any) => Boolean(err?.isNotionError),
    APIErrorCode: {
      Unauthorized: 'unauthorized',
      RestrictedResource: 'restricted_resource',
      ObjectNotFound: 'object_not_found',
      RateLimited: 'rate_limited',
      ValidationError: 'validation_error',
    },
  };
});

describe('NotionIntegrationService (N-2, N-4)', () => {
  let service: NotionIntegrationService;

  const mockSecretKey = '12345678901234567890123456789012';
  const mockEncryptedToken = encryptToken('secret_notion_token_xyz789', mockSecretKey);

  const mockUser: any = {
    _id: '66faef1234567890abcdef01',
    username: 'testuser',
    isDemo: false,
    notion: {
      accessTokenEnc: mockEncryptedToken,
      workspaceName: 'Acme Corp',
    },
  };

  const mockDemoUser: any = {
    _id: 'demo_user_id_999',
    username: 'demo_user',
    isDemo: true,
  };

  const mockUserModel = {
    findById: vi.fn(),
    updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
  };

  const mockConfigService = {
    get: vi.fn().mockImplementation((key: string) => {
      if (key === 'notion.clientId') return 'mock_notion_client_id';
      if (key === 'notion.clientSecret') return 'mock_notion_client_secret';
      if (key === 'notion.redirectUri') return 'https://codescribe.app/integrations/notion/callback';
      if (key === 'githubTokenEncryptionKey') return mockSecretKey;
      return null;
    }),
  };

  const mockJwtService = {
    sign: vi.fn().mockReturnValue('mock_signed_state_jwt'),
    verify: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new NotionIntegrationService(
      mockUserModel as any,
      mockConfigService as any,
      mockJwtService as any,
    );
  });

  describe('getAuthUrl', () => {
    it('debe generar una URL de autorización de Notion con state firmado para usuarios normales', async () => {
      const result = await service.getAuthUrl(mockUser);

      expect(result.url).toContain('https://api.notion.com/v1/oauth/authorize');
      expect(result.url).toContain('client_id=mock_notion_client_id');
      expect(result.url).toContain('state=mock_signed_state_jwt');
      expect(mockJwtService.sign).toHaveBeenCalled();
    });

    it('debe rechazar con 403 si el usuario es demo', async () => {
      await expect(service.getAuthUrl(mockDemoUser)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('handleCallback', () => {
    it('debe rechazar con 400 si el state es inválido o expiró', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(
        service.handleCallback(mockUser, { code: 'code_123', state: 'bad_state' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe rechazar con 400 si el state pertenece a otro usuario (CSRF)', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'other_user_id',
        purpose: 'notion-oauth',
      });

      await expect(
        service.handleCallback(mockUser, { code: 'code_123', state: 'valid_state' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe canjear el código con éxito, cifrar el token y guardarlo en el usuario', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: '66faef1234567890abcdef01',
        purpose: 'notion-oauth',
      });

      // Mock de global.fetch para Notion token exchange
      const mockFetchResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          access_token: 'notion_api_secret_fresh_token_123',
          workspace_name: 'Espacio de Prueba',
          workspace_id: 'ws-123',
          bot_id: 'bot-123',
        }),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockFetchResponse));

      const result = await service.handleCallback(mockUser, {
        code: 'auth_code_notion_success',
        state: 'valid_state_jwt',
      });

      expect(result.connected).toBe(true);
      expect(result.workspaceName).toBe('Espacio de Prueba');

      // Verificar que updateOne fue llamado con token cifrado y sin exponer el token plano
      expect(mockUserModel.updateOne).toHaveBeenCalledTimes(1);
      const updateArgs = mockUserModel.updateOne.mock.calls[0][1].$set;
      expect(updateArgs.notion.accessTokenEnc).toBeDefined();
      expect(updateArgs.notion.accessTokenEnc).not.toBe('notion_api_secret_fresh_token_123');
      expect(decryptToken(updateArgs.notion.accessTokenEnc, mockSecretKey)).toBe(
        'notion_api_secret_fresh_token_123',
      );

      vi.unstubAllGlobals();
    });
  });

  describe('getStatus', () => {
    it('debe devolver connected: true y workspaceName si el usuario tiene token', async () => {
      mockUserModel.findById.mockReturnValue({
        select: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue(mockUser),
        }),
      });

      const status = await service.getStatus(mockUser);
      expect(status).toEqual({
        connected: true,
        workspaceName: 'Acme Corp',
      });
    });

    it('debe devolver connected: false para usuario demo', async () => {
      const status = await service.getStatus(mockDemoUser);
      expect(status).toEqual({
        connected: false,
        workspaceName: null,
      });
    });
  });

  describe('getPages', () => {
    it('debe mapear títulos y emojis de las páginas compartidas con la integración', async () => {
      mockUserModel.findById.mockReturnValue({
        select: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue(mockUser),
        }),
      });

      const mockClientInstance = new Client();
      vi.mocked(mockClientInstance.search).mockResolvedValueOnce({
        results: [
          {
            object: 'page',
            id: 'page-uuid-1',
            icon: { type: 'emoji', emoji: '📘' },
            properties: {
              Name: {
                type: 'title',
                title: [{ plain_text: 'Manual de Arquitectura' }],
              },
            },
          },
          {
            object: 'page',
            id: 'page-uuid-2',
            properties: {
              Title: {
                type: 'title',
                title: [{ plain_text: 'Roadmap 2026' }],
              },
            },
          },
        ],
      } as any);

      const pages = await service.getPages(mockUser);
      expect(pages).toHaveLength(2);
      expect(pages[0]).toEqual({
        id: 'page-uuid-1',
        title: 'Manual de Arquitectura',
        icon: '📘',
      });
      expect(pages[1]).toEqual({
        id: 'page-uuid-2',
        title: 'Roadmap 2026',
        icon: undefined,
      });
    });

    it('debe limpiar el token de la BD y lanzar 401 NOTION_RECONNECT_REQUIRED si Notion devuelve 401', async () => {
      mockUserModel.findById.mockReturnValue({
        select: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue(mockUser),
        }),
      });

      const mockClientInstance = new Client();
      vi.mocked(mockClientInstance.search).mockRejectedValueOnce({
        isNotionError: true,
        code: 'unauthorized',
        message: 'Token revoked',
      });

      await expect(service.getPages(mockUser)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockUserModel.updateOne).toHaveBeenCalledWith(
        { _id: '66faef1234567890abcdef01' },
        { $unset: { notion: 1 } },
      );
    });
  });

  describe('disconnect', () => {
    it('debe desvincular la cuenta eliminando notion del usuario', async () => {
      const result = await service.disconnect(mockUser);
      expect(result).toEqual({ success: true });
      expect(mockUserModel.updateOne).toHaveBeenCalledWith(
        { _id: '66faef1234567890abcdef01' },
        { $unset: { notion: 1 } },
      );
    });
  });
});
