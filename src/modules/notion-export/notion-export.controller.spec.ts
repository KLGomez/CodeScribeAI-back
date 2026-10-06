import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotionExportController } from './notion-export.controller';
import { NotionExportService } from './notion-export.service';
import { ExportNotionDto } from './dto/export-notion.dto';

describe('NotionExportController', () => {
  let controller: NotionExportController;
  let service: NotionExportService;

  const mockUser: any = {
    _id: '66faef1234567890abcdef01',
    username: 'testuser',
  };

  beforeEach(() => {
    service = new NotionExportService({} as any, {} as any, {} as any);
    controller = new NotionExportController(service);
  });

  it('debe llamar al servicio exportMarkdownToNotion con el usuario autenticado y retornar el resultado', async () => {
    const dto: ExportNotionDto = {
      documentationId: '66faef1234567890abcdef02',
      targetPageId: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
      title: 'Título del Documento',
    };

    const expectedResult = {
      success: true,
      url: 'https://notion.so/test-url-1234',
    };

    vi.spyOn(service, 'exportMarkdownToNotion').mockResolvedValueOnce(expectedResult);

    const result = await controller.exportToNotion(mockUser, dto);
    expect(result).toEqual(expectedResult);
    expect(service.exportMarkdownToNotion).toHaveBeenCalledWith(mockUser, dto);
  });
});
