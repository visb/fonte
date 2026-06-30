import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
import { BibleCourseClassPhotoService } from './bible-course-class-photo.service';
import { BIBLE_COURSE_CLASS_PHOTO_MAX_BYTES } from './bible-course-class-photo.mimetypes';

const uploadOptions = {
  storage: memoryStorage(),
  limits: { fileSize: BIBLE_COURSE_CLASS_PHOTO_MAX_BYTES },
};

/**
 * Galeria de fotos por turma do curso bíblico (story 92). Controller fino:
 * recebe o multipart (campo `file`), garante presença e delega ao service, que é
 * a autoridade para allowlist de mimetype, existência da turma e remoção. Guard
 * JWT + qualquer Staff (ADMIN, COORDINATOR, SERVANT) — alinhado a operadores de
 * casa registrando o dia a dia.
 */
@Controller('bible-course/classes/:classId/photos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.COORDINATOR, Role.SERVANT)
export class BibleCourseClassPhotoController {
  constructor(private service: BibleCourseClassPhotoService) {}

  @Get()
  list(@Param('classId', ParseUUIDPipe) classId: string) {
    return this.service.listPhotos(classId);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file', uploadOptions))
  upload(
    @Param('classId', ParseUUIDPipe) classId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) throw new BadRequestException('File not provided');
    return this.service.addPhoto(classId, file, user.userId);
  }

  @Delete(':photoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('classId', ParseUUIDPipe) classId: string,
    @Param('photoId', ParseUUIDPipe) photoId: string,
  ) {
    return this.service.removePhoto(classId, photoId);
  }
}
