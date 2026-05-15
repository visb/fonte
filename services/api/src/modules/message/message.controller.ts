import {
  BadRequestException,
  Body,
  Controller,
  Get,
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
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { StorageService } from '../storage/storage.service';
import { SendMessageDto } from './dto/send-message.dto';
import { SendDirectMessageDto } from './dto/send-direct-message.dto';
import { MessageService } from './message.service';

const ALLOWED_MIMETYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'audio/mpeg', 'audio/mp4', 'audio/m4a', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/aac',
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

@Controller('messages')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MessageController {
  constructor(
    private service: MessageService,
    private storage: StorageService,
  ) {}

  @Get('conversations')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR)
  getConversations(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getConversations(user.userId);
  }

  @Get('my-conversations')
  @Roles(Role.RESIDENT, Role.RELATIVE)
  getMyConversations(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getMyConversations(user.userId, user.role);
  }

  @Get('conversations/:residentId/:relativeId')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR, Role.RESIDENT, Role.RELATIVE)
  getThread(
    @CurrentUser() user: AuthenticatedUser,
    @Param('residentId', ParseUUIDPipe) residentId: string,
    @Param('relativeId', ParseUUIDPipe) relativeId: string,
  ) {
    return this.service.getThread(user.userId, user.role, residentId, relativeId);
  }

  @Get('pending')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR)
  getPending(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getPending(user.userId);
  }

  @Post('upload')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR, Role.RESIDENT, Role.RELATIVE)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } }))
  async uploadAttachment(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Arquivo não enviado');
    if (!ALLOWED_MIMETYPES.has(file.mimetype)) throw new BadRequestException('Tipo de arquivo não permitido');

    const type = file.mimetype.startsWith('image/') ? 'image'
      : file.mimetype.startsWith('audio/') ? 'audio'
      : 'document';
    const filename = this.storage.uniqueFilename(file.originalname);
    const url = await this.storage.upload('messages', filename, file.buffer, file.mimetype);
    return { url, type };
  }

  @Post()
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR, Role.RESIDENT, Role.RELATIVE)
  send(@CurrentUser() user: AuthenticatedUser, @Body() dto: SendMessageDto) {
    return this.service.send(user.userId, user.profileType, dto);
  }

  @Get('house-staff-threads')
  @Roles(Role.RELATIVE)
  getHouseStaffThreads(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getHouseStaffThreads(user.userId);
  }

  @Get('direct-conversations')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR)
  getDirectConversations(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getDirectConversations(user.userId);
  }

  @Get('direct/:staffId/:relativeId')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR, Role.RELATIVE)
  getDirectThread(
    @CurrentUser() user: AuthenticatedUser,
    @Param('staffId', ParseUUIDPipe) staffId: string,
    @Param('relativeId', ParseUUIDPipe) relativeId: string,
  ) {
    return this.service.getDirectThread(user.userId, user.role, staffId, relativeId);
  }

  @Post('direct')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR, Role.RELATIVE)
  sendDirect(@CurrentUser() user: AuthenticatedUser, @Body() dto: SendDirectMessageDto) {
    return this.service.sendDirect(user.userId, user.profileType, dto);
  }

  @Patch(':id/approve')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR)
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.approve(user.userId, id);
  }

  @Patch(':id/reject')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR)
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.reject(user.userId, id);
  }
}
