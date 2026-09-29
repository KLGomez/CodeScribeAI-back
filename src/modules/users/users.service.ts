import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { ConfigService } from '@nestjs/config';
import { encryptToken } from '../../common/utils/crypto.util';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private configService: ConfigService,
  ) {}

  async findOrCreate(profile: {
    githubId: string;
    username: string;
    displayName?: string;
    avatarUrl?: string;
    email?: string;
    accessToken: string;
  }): Promise<UserDocument> {
    const key = this.configService.get<string>('githubTokenEncryptionKey');
    const encryptedToken = encryptToken(profile.accessToken, key);

    return this.userModel.findOneAndUpdate(
      { githubId: profile.githubId },
      {
        $set: {
          username: profile.username,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
          email: profile.email,
          githubToken: encryptedToken,
        },
      },
      { upsert: true, new: true },
    );
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  /** Includes the encrypted githubToken field (excluded by default) */
  async findByIdWithToken(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).select('+githubToken').exec();
  }
}
