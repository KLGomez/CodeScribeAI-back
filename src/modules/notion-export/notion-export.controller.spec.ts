import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotionExportController } from './notion-export.controller';
import { NotionExportService } from './notion-export.service';
import { ExportNotionDto } from './dto/export-notion.dto';

describe('NotionExportController', () => {
  let controller: NotionExportController;
  let service: NotionExportService;

  beforeEach(() => {
    service = new NotionExportService();
    controller = new NotionExportController(service);
  });

  it('debe llamar al servicio exportMarkdownToNotion y retornar el resultado', async () => {
    const dto: ExportNotionDto = {
      markdown: '# Documento',
      title: 'Título del Documento',
      targetPageId: 'page-1234',
      notionAccessToken: 'token-abc',
    };

    const expectedResult = {
      success: true,
      url: 'https://notion.so/test-url-1234',
    };

    vi.spyOn(service, 'exportMarkdownToNotion').mockResolvedValueOnce(expectedResult);

    const result = await controller.exportToNotion(dto);
    expect(result).toEqual(expectedResult);
    expect(service.exportMarkdownToNotion).toHaveBeenCalledWith(dto);
  });
});
