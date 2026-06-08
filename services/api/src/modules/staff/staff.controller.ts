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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Role } from '@fonte/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { RevealSensitive } from '../../common/decorators/reveal-sensitive.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { StaffPermissionType } from '@fonte/types';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { UpdateStaffMeDto } from './dto/update-staff-me.dto';
import { AddPermissionDto } from './dto/add-permission.dto';
import { Staff } from './staff.entity';
import { StaffPermission } from './staff-permission.entity';
import { StaffService } from './staff.service';

const photoOptions = { storage: memoryStorage() };

@Controller('staff')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StaffController {
  constructor(private staffService: StaffService) {}

  @Get('me')
  @RevealSensitive()
  getMe(@CurrentUser() user: AuthenticatedUser): Promise<Staff> {
    return this.staffService.findByUserId(user.userId);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateStaffMeDto): Promise<Staff> {
    return this.staffService.updateMe(user.userId, dto);
  }

  @Post('me/photo')
  @UseInterceptors(FileInterceptor('file', photoOptions))
  uploadPhotoMe(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<Staff> {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado');
    if (!file.mimetype.startsWith('image/')) throw new BadRequestException('Apenas imagens são permitidas');
    if (file.size > 5 * 1024 * 1024) throw new BadRequestException('Arquivo muito grande: máximo 5 MB');
    return this.staffService.uploadPhotoMe(user.userId, file);
  }

  @Get()
  @Roles(Role.ADMIN, Role.COORDINATOR)
  findAll(): Promise<Staff[]> {
    return this.staffService.findAll();
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  @RevealSensitive()
  @Audit('staff.read', 'staff')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Staff> {
    return this.staffService.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN)
  @RevealSensitive()
  create(@Body() dto: CreateStaffDto): Promise<Staff> {
    return this.staffService.create(dto);
  }

  @Post(':id/photo')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  @UseInterceptors(FileInterceptor('file', photoOptions))
  uploadPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<Staff> {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado');
    if (!file.mimetype.startsWith('image/')) throw new BadRequestException('Apenas imagens são permitidas');
    if (file.size > 5 * 1024 * 1024) throw new BadRequestException('Arquivo muito grande: máximo 5 MB');
    return this.staffService.uploadPhoto(id, file);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @RevealSensitive()
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStaffDto,
  ): Promise<Staff> {
    return this.staffService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.staffService.remove(id);
  }

  // ─── Permissions ─────────────────────────────────────────────────────────────

  @Get(':id/permissions')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  getPermissions(@Param('id', ParseUUIDPipe) id: string): Promise<StaffPermission[]> {
    return this.staffService.getPermissions(id);
  }

  @Post(':id/permissions')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  addPermission(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddPermissionDto,
  ): Promise<StaffPermission> {
    return this.staffService.addPermission(id, dto.type);
  }

  @Delete(':id/permissions/:type')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.ADMIN, Role.COORDINATOR)
  removePermission(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('type') type: StaffPermissionType,
  ): Promise<void> {
    return this.staffService.removePermission(id, type);
  }
}
