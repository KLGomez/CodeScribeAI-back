import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { DocumentationController } from './documentation.controller';
import { DocumentationService } from './documentation.service';

describe('DocumentationController', () => {
  let controller: DocumentationController;
  let service: DocumentationService;

  const mockUser: any = {
    _id: '66faef1234567890abcdef01',
    username: 'testuser',
  };

  const mockDoc = {
    _id: 'doc-123',
    userId: '66faef1234567890abcdef01',
    repoUrl: 'https://github.com/facebook/react',
    content: '# Test Docs',
  };

  const mockDocService = {
    findByUser: vi.fn().mockResolvedValue([mockDoc]),
    findById: vi.fn().mockResolvedValue(mockDoc),
    delete: vi.fn().mockResolvedValue({ message: 'Documento eliminado correctamente' }),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentationController],
      providers: [
        {
          provide: DocumentationService,
          useValue: mockDocService,
        },
      ],
    }).compile();

    controller = module.get<DocumentationController>(DocumentationController);
    service = module.get<DocumentationService>(DocumentationService);
  });

  describe('findAll', () => {
    it('should return all documents for the authenticated user', async () => {
      const result = await controller.findAll(mockUser);
      expect(result).toEqual([mockDoc]);
      expect(service.findByUser).toHaveBeenCalledWith('66faef1234567890abcdef01');
    });

    it('should throw UnauthorizedException if user is not provided', () => {
      expect(() => controller.findAll(null as any)).toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('findOne', () => {
    it('should return document if owned by user', async () => {
      const result = await controller.findOne('doc-123', mockUser);
      expect(result).toEqual(mockDoc);
      expect(service.findById).toHaveBeenCalledWith('doc-123', '66faef1234567890abcdef01');
    });
  });

  describe('remove', () => {
    it('should delete document verifying user ownership', async () => {
      const result = await controller.remove('doc-123', mockUser);
      expect(result).toEqual({ message: 'Documento eliminado correctamente' });
      expect(service.delete).toHaveBeenCalledWith('doc-123', '66faef1234567890abcdef01');
    });
  });
});
