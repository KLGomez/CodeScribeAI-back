import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Documentation,
  DocumentationDocument,
} from './schemas/documentation.schema';

@Injectable()
export class DocumentationService {
  constructor(
    @InjectModel(Documentation.name)
    private docModel: Model<DocumentationDocument>,
  ) {}

  async create(data: Partial<Documentation>): Promise<DocumentationDocument> {
    return this.docModel.create(data);
  }

  async findById(id: string, userId: string): Promise<DocumentationDocument> {
    const doc = await this.docModel.findOne({
      _id: id,
      userId: new Types.ObjectId(userId),
    });
    if (!doc) throw new NotFoundException('Documentation not found');
    return doc;
  }

  async findByUser(userId: string): Promise<DocumentationDocument[]> {
    return this.docModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .select('-content') // omit heavy content from list endpoint
      .exec();
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.docModel.deleteOne({
      _id: id,
      userId: new Types.ObjectId(userId),
    });
  }
}
