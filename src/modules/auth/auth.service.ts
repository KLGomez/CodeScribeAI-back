import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  signToken(user: UserDocument): string {
    const payload = {
      sub: (user as any)._id.toString(),
      username: user.username,
      avatarUrl: user.avatarUrl,
    };
    return this.jwtService.sign(payload);
  }
}
