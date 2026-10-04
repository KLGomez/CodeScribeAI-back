import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotionExportService } from './notion-export.service';
import { BadRequestException } from '@nestjs/common';
import { Client } from '@notionhq/client';

vi.mock('@notionhq/client', () => {
  const mockCreate = vi.fn();
  const mockAppend = vi.fn();

  class MockClient {
    pages = {
      create: mockCreate,
    };
    blocks = {
      children: {
        append: mockAppend,
      },
    };
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

describe('NotionExportService', () => {
  let service: NotionExportService;

  beforeEach(() => {
    service = new NotionExportService();
    vi.clearAllMocks();
  });

  it('debe exportar markdown a Notion y retornar el url de la página', async () => {
    const mockClientInstance = new Client();
    vi.mocked(mockClientInstance.pages.create).mockResolvedValueOnce({
      id: 'mock-page-id',
      url: 'https://notion.so/mock-page-id',
    } as any);

    const result = await service.exportMarkdownToNotion({
      markdown: '# Test Header\n\nContenido de prueba.',
      title: 'Documento Test',
      targetPageId: 'parent-page-123',
      notionAccessToken: 'secret_token_123',
    });

    expect(result).toEqual({
      success: true,
      url: 'https://notion.so/mock-page-id',
    });
  });

  it('debe lanzar BadRequestException si el token de Notion no es válido', async () => {
    const mockClientInstance = new Client();
    vi.mocked(mockClientInstance.pages.create).mockRejectedValueOnce({
      isNotionError: true,
      code: 'unauthorized',
      message: 'API token is invalid.',
    });

    await expect(
      service.exportMarkdownToNotion({
        markdown: '# Test',
        title: 'Test',
        targetPageId: 'parent-123',
        notionAccessToken: 'invalid_token',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
