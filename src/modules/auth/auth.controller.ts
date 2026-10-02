import { Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { ConfigService } from '@nestjs/config';
import { Public } from '../../common/decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
    private configService: ConfigService,
  ) {}

  /** Step 1: redirect user to GitHub OAuth consent screen */
  @Public()
  @Get('github')
  @UseGuards(AuthGuard('github'))
  githubLogin() {
    // Passport handles the redirect automatically
  }

  /** Step 2: GitHub redirects back here with ?code= */
  @Public()
  @Get('github/callback')
  @UseGuards(AuthGuard('github'))
  githubCallback(@Req() req: any, @Res() res: Response) {
    const token = this.authService.signToken(req.user);
    const frontendUrl = this.configService.get<string>('frontendUrl');
    // Send JWT to frontend via redirect with query param
    res.redirect(`${frontendUrl}/auth/callback?jwt=${token}`);
  }

  /** Endpoint para entrar en Modo Demo con usuario real en MongoDB y JWT válido */
  @Public()
  @Post('demo')
  async demoLogin() {
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const demoUser = await this.usersService.findOrCreate({
      githubId: `demo_${Date.now()}_${randomSuffix}`,
      username: `demo_${randomSuffix}`,
      displayName: `Usuario Demo (${randomSuffix})`,
      avatarUrl: 'https://avatars.githubusercontent.com/u/9919?s=200&v=4',
      email: `demo_${randomSuffix}@codescribe.local`,
      accessToken: 'ghp_demo_mock_token_for_local_testing',
    });
    const token = this.authService.signToken(demoUser);
    return {
      token,
      user: {
        id: (demoUser as any)._id,
        username: demoUser.username,
        displayName: demoUser.displayName,
        avatarUrl: demoUser.avatarUrl,
        email: demoUser.email,
        plan: demoUser.plan,
        analysisCount: demoUser.analysisCount,
      },
    };
  }
}
