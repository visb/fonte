import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { BibleCourseClassPhoto as BibleCourseClassPhotoDto } from '@fonte/types';
import { BibleCourseClassPhoto } from './bible-course-class-photo.entity';
import { BibleCourseClass } from './bible-course-class.entity';
import { StorageService } from '../storage/storage.service';
import { isAllowedClassPhotoMimetype } from './bible-course-class-photo.mimetypes';

/**
 * Galeria de fotos por turma do curso bíblico (story 92). Reusa a infra de
 * storage do `StorageService`, espelhando `ActivityAttachmentService`
 * simplificado: só imagens, sem comment/duration. O backend é a autoridade para
 * upload (allowlist de mimetype, turma existente) e remoção (soft delete +
 * delete físico do objeto no bucket, best-effort).
 */
@Injectable()
export class BibleCourseClassPhotoService {
  private readonly logger = new Logger(BibleCourseClassPhotoService.name);

  constructor(
    @InjectRepository(BibleCourseClassPhoto)
    private repo: Repository<BibleCourseClassPhoto>,
    @InjectRepository(BibleCourseClass)
    private classRepo: Repository<BibleCourseClass>,
    private storage: StorageService,
  ) {}

  private async loadClassOrFail(classId: string): Promise<BibleCourseClass> {
    const klass = await this.classRepo.findOne({ where: { id: classId } });
    if (!klass) throw new NotFoundException(`BibleCourseClass ${classId} not found`);
    return klass;
  }

  /**
   * Sobe uma foto para a turma: valida que a turma existe (não soft-deletada) e o
   * mimetype contra a allowlist, grava no storage e persiste. Autor = usuário
   * autenticado.
   */
  async addPhoto(
    classId: string,
    file: Express.Multer.File,
    userId: string,
  ): Promise<BibleCourseClassPhotoDto> {
    const klass = await this.loadClassOrFail(classId);
    if (!file) throw new BadRequestException('File not provided');
    if (!isAllowedClassPhotoMimetype(file.mimetype)) {
      throw new BadRequestException('File type not allowed');
    }

    const fileName = this.storage.decodeOriginalName(file.originalname);
    const filename = this.storage.uniqueFilename(file.originalname);
    const fileUrl = await this.storage.upload(
      'bible-course-classes',
      filename,
      file.buffer,
      file.mimetype,
    );

    const photo = this.repo.create({
      classId: klass.id,
      fileUrl,
      fileName,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      createdByUserId: userId,
    });
    const saved = await this.repo.save(photo);
    return this.toView(saved);
  }

  /** Lista as fotos da turma (exclui soft-deletadas), mais antigas primeiro. */
  async listPhotos(classId: string): Promise<BibleCourseClassPhotoDto[]> {
    await this.loadClassOrFail(classId);
    const rows = await this.repo.find({
      where: { classId, deletedAt: IsNull() },
      order: { createdAt: 'ASC' },
    });
    return rows.map((p) => this.toView(p));
  }

  /**
   * Remove uma foto da turma: soft delete do registro + delete físico do objeto
   * no bucket (best-effort — falha de delete loga e segue, não aborta).
   */
  async removePhoto(classId: string, photoId: string): Promise<void> {
    await this.loadClassOrFail(classId);
    const photo = await this.repo.findOne({ where: { id: photoId, classId } });
    if (!photo) throw new NotFoundException('Photo not found');

    // Best-effort: falha ao apagar o objeto no bucket loga e segue — não aborta
    // o soft delete do registro (coerente com a limpeza de bucket, story 93).
    try {
      await this.storage.delete(photo.fileUrl);
    } catch (err) {
      this.logger.warn(
        `Failed to delete bucket object for class photo ${photo.id}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
    await this.repo.softRemove(photo);
  }

  private toView(p: BibleCourseClassPhoto): BibleCourseClassPhotoDto {
    return {
      id: p.id,
      classId: p.classId,
      fileUrl: p.fileUrl,
      fileName: p.fileName,
      mimeType: p.mimeType,
      sizeBytes: p.sizeBytes,
      createdByUserId: p.createdByUserId,
      createdAt:
        p.createdAt instanceof Date
          ? p.createdAt.toISOString()
          : String(p.createdAt),
    };
  }
}
