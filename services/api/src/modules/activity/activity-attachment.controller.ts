import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Role } from '@fonte/types';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { ActivityAttachmentService } from './activity-attachment.service';
import { ACTIVITY_ATTACHMENT_MAX_BYTES } from './activity-attachment.mimetypes';

const uploadOptions = {
  storage: memoryStorage(),
  limits: { fileSize: ACTIVITY_ATTACHMENT_MAX_BYTES },
};

/**
 * Anexos de atividade e de comentário (story 73). Controller fino: recebe o
 * multipart (campo `file`), garante presença e delega ao service, que é a
 * autoridade para allowlist de mimetype, visibilidade e permissão de exclusão.
 */
@Controller('activities/:activityId')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.COORDINATOR, Role.SERVANT)
export class ActivityAttachmentController {
  constructor(private service: ActivityAttachmentService) {}

  /**
   * `durationSeconds` chega como string no multipart (story 74). Só é usada para
   * áudio; o service descarta valores inválidos e zera para não-áudio.
   */
  private parseDuration(body: {
    durationSeconds?: string;
  }): number | null {
    const raw = body?.durationSeconds;
    if (raw == null || raw === '') return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }

  @Post('attachments')
  @UseInterceptors(FileInterceptor('file', uploadOptions))
  uploadActivityAttachment(
    @Param('activityId', ParseUUIDPipe) activityId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { durationSeconds?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) throw new BadRequestException('File not provided');
    return this.service.addActivityAttachment(
      activityId,
      file,
      user,
      this.parseDuration(body),
    );
  }

  @Post('comments/:commentId/attachments')
  @UseInterceptors(FileInterceptor('file', uploadOptions))
  uploadCommentAttachment(
    @Param('activityId', ParseUUIDPipe) activityId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { durationSeconds?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) throw new BadRequestException('File not provided');
    return this.service.addCommentAttachment(
      activityId,
      commentId,
      file,
      user,
      this.parseDuration(body),
    );
  }

  @Delete('attachments/:attachmentId')
  @HttpCode(204)
  deleteAttachment(
    @Param('activityId', ParseUUIDPipe) activityId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.deleteAttachment(activityId, attachmentId, user);
  }
}
