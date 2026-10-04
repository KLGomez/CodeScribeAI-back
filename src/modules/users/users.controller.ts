import {
  Controller,
  Get,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserDocument } from './schemas/user.schema';
import { UsersService } from './users.service';

@Controller(['users', 'auth'])
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: UserDocument) {
    return {
      id: (user as any)._id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      email: user.email,
      plan: user.plan,
      analysisCount: user.analysisCount,
    };
  }

  @Delete('me')
  @HttpCode(HttpStatus.OK)
  async deleteAccount(@CurrentUser() user: any) {
    const userId = user?._id?.toString() || user?.id || user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Usuario no autenticado');
    }

    await this.usersService.deleteAccount(userId);

    return {
      success: true,
      message: 'Cuenta y datos asociados eliminados definitivamente',
    };
  }
}

