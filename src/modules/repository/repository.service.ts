import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Repository, RepositoryDocument } from './schemas/repository.schema';

@Injectable()
export class RepositoryService {
  constructor(
    @InjectModel(Repository.name) private repoModel: Model<RepositoryDocument>,
  ) {}

  parseGithubUrl(url: string): { owner: string; name: string } {
    const match = url.match(/github\.com\/([\w.-]+)\/([\w.-]+)/);
    if (!match) throw new Error('Invalid GitHub URL');
    return { owner: match[1], name: match[2].replace(/\.git$/, '') };
  }

  async findOrCreate(userId: string, url: string): Promise<RepositoryDocument> {
    const { owner, name } = this.parseGithubUrl(url);
    return this.repoModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId), url },
      { $setOnInsert: { userId: new Types.ObjectId(userId), url, owner, name } },
      { upsert: true, new: true },
    );
  }
}
