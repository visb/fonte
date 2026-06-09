import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Role } from '@fonte/types';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateRelativeDto } from './dto/create-relative.dto';
import { GenerateRelativeAccessDto } from './dto/generate-relative-access.dto';
import { ResetRelativePasswordDto } from './dto/reset-relative-password.dto';
import { UpdateRelativeMeDto } from './dto/update-relative-me.dto';
import { Relative } from './relative.entity';
import { RelativeMeView, RelativeService } from './relative.service';

const photoOptions = { storage: memoryStorage() };

@Controller('relatives')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RelativeController {
  constructor(private relativeService: RelativeService) {}

  @Get('me')
  @Roles(Role.RELATIVE)
  findMe(@CurrentUser() user: AuthenticatedUser): Promise<RelativeMeView> {
    return this.relativeService.findMe(user.userId);
  }

  @Patch('me')
  @Roles(Role.RELATIVE)
  updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateRelativeMeDto,
  ): Promise<RelativeMeView> {
    return this.relativeService.updateMe(user.userId, dto);
  }

  @Post('me/photo')
  @Roles(Role.RELATIVE)
  @UseInterceptors(FileInterceptor('file', photoOptions))
  uploadPhoto(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<RelativeMeView> {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado');
    if (!file.mimetype.startsWith('image/')) throw new BadRequestException('Apenas imagens sÃ£o permitidas');
    if (file.size > 5 * 1024 * 1024) throw new BadRequestException('Arquivo muito grande: mÃ¡ximo 5 MB');
    return this.relativeService.uploadPhoto(user.userId, file);
  }

  @Get()
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.SERVANT)
  findByResident(
    @Query('residentId', ParseUUIDPipe) residentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Relative[]> {
    return this.relativeService.findByResident(residentId, { role: user.role, userId: user.userId });
  }

  @Post()
  @Roles(Role.ADMIN, Role.COORDINATOR)
  create(@Body() dto: CreateRelativeDto): Promise<Relative> {
    return this.relativeService.create(dto);
  }

  @Patch(':id/responsible')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  setResponsible(@Param('id', ParseUUIDPipe) id: string): Promise<Relative> {
    return this.relativeService.setResponsible(id);
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
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.SERVANT)
  resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetRelativePasswordDto,
  ): Promise<void> {
    return this.relativeService.resetPassword(id, dto.password);
  }
}
