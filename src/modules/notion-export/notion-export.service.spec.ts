import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { NotionExportService } from './notion-export.service';
import { Client } from '@notionhq/client';
import { encryptToken } from '../../common/utils/crypto.util';

vi.mock('@notionhq/client', () => {
  const mockCreate = vi.fn();
  const mockAppend = vi.fn();
  const mockSearch = vi.fn();

  class MockClient {
    pages = {
      create: mockCreate,
    };
    blocks = {
      children: {
        append: mockAppend,
      },
    };
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

describe('NotionExportService (N-3, N-4)', () => {
  let service: NotionExportService;

  const mockSecretKey = '12345678901234567890123456789012';
  const mockEncryptedToken = encryptToken('secret_notion_token_abc123', mockSecretKey);

  const mockUser: any = {
    _id: '66faef1234567890abcdef01',
    username: 'testuser',
    isDemo: false,
    notion: {
      accessTokenEnc: mockEncryptedToken,
      workspaceName: 'Mi Workspace',
    },
  };

  const mockDemoUser: any = {
    _id: 'demo_user_id_123',
    username: 'demo_user',
    isDemo: true,
  };

  const mockDoc: any = {
    _id: '66faef1234567890abcdef02',
    userId: '66faef1234567890abcdef01',
    repoUrl: 'https://github.com/KLGomez/repo',
    content: '# Documentación de prueba\n\nEste es un documento extenso.',
  };

  const mockDocModel = {
    findById: vi.fn(),
  };

  const mockUserModel = {
    findById: vi.fn(),
  };

  const mockConfigService = {
    get: vi.fn().mockImplementation((key: string) => {
      if (key === 'githubTokenEncryptionKey') return mockSecretKey;
      return null;
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new NotionExportService(
      mockDocModel as any,
      mockUserModel as any,
      mockConfigService as any,
    );
  });

  it('debe exportar exitosamente un documento propio a Notion', async () => {
    mockDocModel.findById.mockReturnValue({
      exec: vi.fn().mockResolvedValue(mockDoc),
    });
    mockUserModel.findById.mockReturnValue({
      select: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockUser),
      }),
    });

    const mockClientInstance = new Client();
    vi.mocked(mockClientInstance.pages.create).mockResolvedValueOnce({
      id: 'mock-page-id-123',
      url: 'https://notion.so/mock-page-id-123',
    } as any);

    const result = await service.exportMarkdownToNotion(mockUser, {
      documentationId: '66faef1234567890abcdef02',
      targetPageId: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
      title: 'Documento Test',
    });

    expect(result.success).toBe(true);
    expect(result.url).toBe('https://notion.so/mock-page-id-123');
  });

  it('debe rechazar la exportación con 403 si el usuario es demo (N-4)', async () => {
    await expect(
      service.exportMarkdownToNotion(mockDemoUser, {
        documentationId: '66faef1234567890abcdef02',
        targetPageId: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('debe rechazar con 404 si el documento no existe', async () => {
    mockDocModel.findById.mockReturnValue({
      exec: vi.fn().mockResolvedValue(null),
    });

    await expect(
      service.exportMarkdownToNotion(mockUser, {
        documentationId: '66faef1234567890abcdef99',
        targetPageId: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('debe rechazar con 403 si el documento pertenece a otro usuario', async () => {
    const foreignDoc = { ...mockDoc, userId: 'other_user_id_456' };
    mockDocModel.findById.mockReturnValue({
      exec: vi.fn().mockResolvedValue(foreignDoc),
    });

    await expect(
      service.exportMarkdownToNotion(mockUser, {
        documentationId: '66faef1234567890abcdef02',
        targetPageId: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('debe rechazar con 409 si el usuario no tiene cuenta de Notion vinculada', async () => {
    mockDocModel.findById.mockReturnValue({
      exec: vi.fn().mockResolvedValue(mockDoc),
    });
    mockUserModel.findById.mockReturnValue({
      select: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue({ ...mockUser, notion: undefined }),
      }),
    });

    await expect(
      service.exportMarkdownToNotion(mockUser, {
        documentationId: '66faef1234567890abcdef02',
        targetPageId: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('debe partir textos largos de más de 2000 caracteres y paginar bloques si superan 100 bloques', async () => {
    // Generar markdown extenso con un parrafo de 2500 caracteres y 120 parrafos
    const longParagraph = 'A'.repeat(2500);
    const manyParagraphs = Array.from({ length: 110 }, (_, i) => `Párrafo ${i}: texto`).join('\n\n');
    const fullMarkdown = `# Título\n\n${longParagraph}\n\n${manyParagraphs}`;

    mockDocModel.findById.mockReturnValue({
      exec: vi.fn().mockResolvedValue({ ...mockDoc, content: fullMarkdown }),
    });
    mockUserModel.findById.mockReturnValue({
      select: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockUser),
      }),
    });

    const mockClientInstance = new Client();
    vi.mocked(mockClientInstance.pages.create).mockResolvedValueOnce({
      id: 'mock-page-large-id',
      url: 'https://notion.so/mock-page-large-id',
    } as any);
    vi.mocked(mockClientInstance.blocks.children.append).mockResolvedValueOnce({} as any);

    const result = await service.exportMarkdownToNotion(mockUser, {
      documentationId: '66faef1234567890abcdef02',
      targetPageId: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    });

    expect(result.success).toBe(true);
    // Verificar que blocks.children.append fue invocado para los bloques restantes (>100)
    expect(mockClientInstance.blocks.children.append).toHaveBeenCalled();
  });
});
