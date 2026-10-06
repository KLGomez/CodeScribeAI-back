import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  Body,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import * as crypto from 'crypto';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../common/redis/redis.service';
import { Public } from '../../common/decorators/public.decorator';
import { ExchangeCodeDto } from './dto/exchange-code.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
    private configService: ConfigService,
    private redisService: RedisService,
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
  async githubCallback(@Req() req: any, @Res() res: Response) {
    const userId = (req.user as any)._id.toString();
    const code = crypto.randomBytes(32).toString('hex');

    // Guardar código de un solo uso en Redis con TTL de 60 segundos
    await this.redisService.set(`auth:code:${code}`, userId, 60);

    const frontendUrl = this.configService.get<string>('frontendUrl');
    // Redirige al frontend con el código de autorización (sin JWT en la URL)
    res.redirect(`${frontendUrl}/auth/callback?code=${code}`);
  }

  /** Step 3: Canje seguro del código de un solo uso por JWT */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('exchange')
  async exchangeCode(@Body() dto: ExchangeCodeDto) {
    const userId = await this.redisService.get(`auth:code:${dto.code}`);
    if (!userId) {
      throw new UnauthorizedException('Código de autorización inválido o expirado');
    }

    // Consumir inmediatamente el código para evitar cualquier reutilización
    await this.redisService.del(`auth:code:${dto.code}`);

    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    const token = this.authService.signToken(user);
    return {
      token,
      user: {
        id: (user as any)._id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        email: user.email,
        plan: user.plan,
        analysisCount: user.analysisCount,
        isDemo: user.isDemo || false,
      },
    };
  }

  /** Endpoint para entrar en Modo Demo con usuario efímero aislado (24h) y JWT válido */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  @Post('demo')
  async demoLogin() {
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const demoUser = await this.usersService.createDemoUser({
      githubId: `demo_${Date.now()}_${randomSuffix}`,
      username: `demo_${randomSuffix}`,
      displayName: `Usuario Demo (${randomSuffix})`,
      avatarUrl: 'https://avatars.githubusercontent.com/u/9919?s=200&v=4',
      email: `demo_${randomSuffix}@codescribe.local`,
      expiresAt,
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
        isDemo: true,
      },
    };
  }
}
