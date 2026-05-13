import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@fonte/types';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateRelativeDto } from './dto/create-relative.dto';
import { GenerateRelativeAccessDto } from './dto/generate-relative-access.dto';
import { ResetRelativePasswordDto } from './dto/reset-relative-password.dto';
import { Relative } from './relative.entity';
import { RelativeMeView, RelativeService } from './relative.service';

@Controller('relatives')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RelativeController {
  constructor(private relativeService: RelativeService) {}

  @Get('me')
  @Roles(Role.RELATIVE)
  findMe(@CurrentUser() user: AuthenticatedUser): Promise<RelativeMeView> {
    return this.relativeService.findMe(user.userId);
  }

  @Get()
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR)
  findByResident(
    @Query('residentId', ParseUUIDPipe) residentId: string,
  ): Promise<Relative[]> {
    return this.relativeService.findByResident(residentId);
  }

  @Post()
  @Roles(Role.ADMIN, Role.COORDINATOR)
  create(@Body() dto: CreateRelativeDto): Promise<Relative> {
    return this.relativeService.create(dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.ADMIN, Role.COORDINATOR)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.relativeService.remove(id);
  }

  @Post(':id/access')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  generateAccess(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GenerateRelativeAccessDto,
  ): Promise<Relative> {
    return this.relativeService.generateAccess(id, dto.email, dto.password);
  }

  @Post(':id/access/reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR)
  resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetRelativePasswordDto,
  ): Promise<void> {
    return this.relativeService.resetPassword(id, dto.password);
  }
}
