import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StaffAttachment as StaffAttachmentDto } from '@fonte/types';
import { StaffAttachment } from './staff-attachment.entity';
import { Staff } from './staff.entity';
import { StorageService } from '../storage/storage.service';
import { isAllowedStaffAttachmentMimetype } from './staff-attachment.mimetypes';

/**
 * Anexos genéricos do servo (story 98). Reusa a infra de storage e o padrão de
 * anexos existente (resident/activity): upload na pasta `attachments/staff`,
 * soft delete do registro e limpeza best-effort do objeto no bucket (coerente
 * com a story 93 — falha no storage loga e segue, não aborta a remoção).
 */
@Injectable()
export class StaffAttachmentService {
  private readonly logger = new Logger(StaffAttachmentService.name);

  constructor(
    @InjectRepository(StaffAttachment)
    private repo: Repository<StaffAttachment>,
    @InjectRepository(Staff)
    private staffRepo: Repository<Staff>,
    private storage: StorageService,
  ) {}

  // Servo precisa existir e não estar soft-deletado (find padrão do TypeORM já
  // exclui deleted_at preenchido).
  private async assertStaffExists(staffId: string): Promise<void> {
    const exists = await this.staffRepo.exists({ where: { id: staffId } });
    if (!exists) throw new NotFoundException(`Staff ${staffId} not found`);
  }

  /**
   * Sobe o arquivo (allowlist de mimetype) para `attachments/staff` e persiste
   * o registro. Autor = usuário autenticado.
   */
  async addAttachment(
    staffId: string,
    file: Express.Multer.File,
    userId: string,
  ): Promise<StaffAttachmentDto> {
    await this.assertStaffExists(staffId);
    if (!file) throw new BadRequestException('File not provided');
    if (!isAllowedStaffAttachmentMimetype(file.mimetype)) {
      throw new BadRequestException('File type not allowed');
    }

    const fileName = this.storage.decodeOriginalName(file.originalname);
    const filename = this.storage.uniqueFilename(file.originalname);
    const fileUrl = await this.storage.upload(
      'attachments/staff',
      filename,
      file.buffer,
      file.mimetype,
    );

    const saved = await this.repo.save(
      this.repo.create({
        staffId,
        fileUrl,
        fileName,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        createdByUserId: userId,
      }),
    );
    return this.toView(saved);
  }

  /** Lista os anexos do servo (soft-deletados excluídos pelo find padrão). */
  async listAttachments(staffId: string): Promise<StaffAttachmentDto[]> {
    await this.assertStaffExists(staffId);
    const rows = await this.repo.find({
      where: { staffId },
      order: { createdAt: 'DESC' },
    });
    return rows.map((a) => this.toView(a));
  }

  /**
   * Soft delete do registro + delete do objeto no bucket (best-effort: falha no
   * storage loga e segue — o registro some da listagem de qualquer forma; o
   * reconcile da story 93 varre órfãos).
   */
  async removeAttachment(staffId: string, attachmentId: string): Promise<void> {
    const attachment = await this.repo.findOne({
      where: { id: attachmentId, staffId },
    });
    if (!attachment) throw new NotFoundException('Attachment not found');

    try {
      await this.storage.delete(attachment.fileUrl);
    } catch (err) {
      this.logger.warn(
        `Failed to delete staff attachment object ${attachment.fileUrl}: ${(err as Error).message}`,
      );
    }
    await this.repo.softRemove(attachment);
  }

  private toView(a: StaffAttachment): StaffAttachmentDto {
    return {
      id: a.id,
      staffId: a.staffId,
      fileUrl: a.fileUrl,
      fileName: a.fileName,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      createdByUserId: a.createdByUserId,
      createdAt:
        a.createdAt instanceof Date
          ? a.createdAt.toISOString()
          : String(a.createdAt),
    };
  }
}
