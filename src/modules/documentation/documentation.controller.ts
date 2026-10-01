import { Controller, Get, Delete, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DocumentationService } from './documentation.service';
import { UserDocument } from '../users/schemas/user.schema';

@Controller('documentation')
@UseGuards(JwtAuthGuard)
export class DocumentationController {
  constructor(private docService: DocumentationService) {}

  @Get()
  findAll(@CurrentUser() user: UserDocument) {
    return this.docService.findByUser((user as any)._id.toString());
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: UserDocument) {
    return this.docService.findById(id, (user as any)._id.toString());
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: UserDocument) {
    return this.docService.delete(id, (user as any)._id.toString());
  }
}
