import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Job, JobDocument, JobStatus } from './schemas/job.schema';

@Injectable()
export class JobsService {
  constructor(
    @InjectModel(Job.name) private jobModel: Model<JobDocument>,
    @InjectQueue('analysis') private analysisQueue: Queue,
  ) {}

  async create(userId: string, repoUrl: string): Promise<JobDocument> {
    const job = await this.jobModel.create({
      userId: new Types.ObjectId(userId),
      repoUrl,
      status: JobStatus.QUEUED,
    });
    await this.analysisQueue.add('analyze-repo', {
      jobId: (job as any)._id.toString(),
      userId,
      repoUrl,
    });
    return job;
  }

  async findById(id: string): Promise<JobDocument | null> {
    return this.jobModel.findById(id).exec();
  }

  async findByUser(userId: string): Promise<JobDocument[]> {
    return this.jobModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async updateStatus(
    id: string,
    status: JobStatus,
    extra: Partial<Job> = {},
  ): Promise<void> {
    await this.jobModel.updateOne({ _id: id }, { $set: { status, ...extra } });
  }
}
