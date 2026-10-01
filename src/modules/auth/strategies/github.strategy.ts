import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
  ) {
    super({
      clientID: configService.get<string>('github.clientId'),
      clientSecret: configService.get<string>('github.clientSecret'),
      callbackURL: configService.get<string>('github.callbackUrl'),
      scope: ['read:user', 'user:email', 'public_repo'],
    });
  }

  async validate(
    accessToken: string,
    _refreshToken: string,
    profile: any,
  ): Promise<any> {
    return this.usersService.findOrCreate({
      githubId: String(profile.id),
      username: profile.username,
      displayName: profile.displayName,
      avatarUrl: profile.photos?.[0]?.value,
      email: profile.emails?.[0]?.value,
      accessToken,
    });
  }
}
