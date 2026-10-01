import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserDocument } from './schemas/user.schema';

@Controller('auth')
@UseGuards(JwtAuthGuard)
export class UsersController {
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
}
