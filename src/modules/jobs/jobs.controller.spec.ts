import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

describe('JobsController', () => {
  let controller: JobsController;
  let service: JobsService;

  const mockUser: any = {
    _id: '66faef1234567890abcdef01',
    username: 'testuser',
  };

  const validJobId = '66faef1234567890abcdef99';
  const otherUserId = '66faef1234567890abcdef02';

  const mockJob = {
    _id: validJobId,
    userId: '66faef1234567890abcdef01',
    repoUrl: 'https://github.com/facebook/react',
    status: 'queued',
    progress: 0,
  };

  const mockJobsService = {
    create: vi.fn().mockResolvedValue(mockJob),
    findByUser: vi.fn().mockResolvedValue([mockJob]),
    findById: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [JobsController],
      providers: [
        {
          provide: JobsService,
          useValue: mockJobsService,
        },
      ],
    }).compile();

    controller = module.get<JobsController>(JobsController);
    service = module.get<JobsService>(JobsService);
  });

  describe('create', () => {
    it('should create a job for current user', async () => {
      const result = await controller.create(
        { repoUrl: 'https://github.com/facebook/react' },
        mockUser,
      );
      expect(result).toEqual(mockJob);
      expect(service.create).toHaveBeenCalledWith(
        mockUser._id,
        'https://github.com/facebook/react',
      );
    });
  });

  describe('findOne', () => {
    it('should throw BadRequestException if id is not a valid ObjectId', async () => {
      await expect(controller.findOne('invalid-id', mockUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if job does not exist', async () => {
      mockJobsService.findById.mockResolvedValue(null);
      await expect(controller.findOne(validJobId, mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if job belongs to another user', async () => {
      mockJobsService.findById.mockResolvedValue({
        ...mockJob,
        userId: otherUserId,
      });
      await expect(controller.findOne(validJobId, mockUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should return job if user is the owner', async () => {
      mockJobsService.findById.mockResolvedValue(mockJob);
      const result = await controller.findOne(validJobId, mockUser);
      expect(result).toEqual(mockJob);
    });
  });

  describe('stream', () => {
    it('should throw BadRequestException on invalid id', async () => {
      await expect(controller.stream('not-an-objectid', mockUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ForbiddenException if user does not own job', async () => {
      mockJobsService.findById.mockResolvedValue({
        ...mockJob,
        userId: otherUserId,
      });
      await expect(controller.stream(validJobId, mockUser)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
