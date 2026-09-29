import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';
import { Public } from '../../common/decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
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
}
