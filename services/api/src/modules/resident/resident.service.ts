import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { mkdir, rename, unlink } from 'fs/promises';
import { basename, dirname, join } from 'path';
import { Resident } from './resident.entity';

export interface ResidentDocumentView {
  id: string;
  residentId: string;
  templateId: string;
  templateName: string;
  signed: boolean;
  signedFileUrl: string | null;
  signedAt: Date | null;
  withinWindow: boolean;
}
import { ResidentAttachment } from './resident-attachment.entity';
import { ResidentDocument } from './resident-document.entity';
import { CreateResidentDto } from './dto/create-resident.dto';
import { UpdateResidentDto } from './dto/update-resident.dto';

@Injectable()
export class ResidentService implements OnModuleInit {
  constructor(
    @InjectRepository(Resident)
    private residentRepository: Repository<Resident>,
    @InjectRepository(ResidentDocument)
    private docRepository: Repository<ResidentDocument>,
    @InjectRepository(ResidentAttachment)
    private attachmentRepository: Repository<ResidentAttachment>,
  ) {}

  async onModuleInit() {
    await mkdir(join(process.cwd(), 'uploads', 'residents'), { recursive: true });
    await mkdir(join(process.cwd(), 'uploads', 'documents'), { recursive: true });
    await mkdir(join(process.cwd(), 'uploads', 'attachments'), { recursive: true });
  }

  findAll(): Promise<Resident[]> {
    return this.residentRepository.find({
      relations: ['house'],
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Resident> {
    const resident = await this.residentRepository.findOne({
      where: { id },
      relations: ['house'],
    });
    if (!resident) throw new NotFoundException(`Resident ${id} not found`);
    return resident;
  }

  create(dto: CreateResidentDto): Promise<Resident> {
    const resident = this.residentRepository.create(dto);
    return this.residentRepository.save(resident);
  }

  async update(id: string, dto: UpdateResidentDto): Promise<Resident> {
    await this.findOne(id);
    await this.residentRepository.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.residentRepository.softDelete(id);
  }

  async uploadPhoto(residentId: string, file: Express.Multer.File): Promise<Resident> {
    const resident = await this.findOne(residentId);
    if (resident.photoUrl) {
      const filename = basename(resident.photoUrl);
      const fullPath = join(process.cwd(), 'uploads', 'residents', filename);
      try {
        await rename(fullPath, join(dirname(fullPath), `~${filename}`));
      } catch {
        // arquivo pode não existir no disco
      }
    }
    await this.residentRepository.update(residentId, {
      photoUrl: `/uploads/residents/${file.filename}`,
    });
    return this.findOne(residentId);
  }

  private static readonly SIGNED_EXPIRY_MS = 30 * 60 * 1000;

  async findDocuments(residentId: string): Promise<ResidentDocumentView[]> {
    const docs = await this.docRepository.find({
      where: { residentId },
      relations: ['template'],
      order: { template: { name: 'ASC' } },
    });
    const now = Date.now();
    return docs.map((doc) => {
      const withinWindow =
        !!doc.signedFileUrl &&
        now - new Date(doc.updatedAt).getTime() <= ResidentService.SIGNED_EXPIRY_MS;
      return {
        id: doc.id,
        residentId: doc.residentId,
        templateId: doc.templateId,
        templateName: doc.template?.name ?? '',
        signed: !!doc.signedFileUrl,
        signedFileUrl: doc.signedFileUrl,
        signedAt: doc.signedFileUrl ? doc.updatedAt : null,
        withinWindow,
      };
    });
  }

  async uploadSignedDocument(
    residentId: string,
    templateId: string,
    file: Express.Multer.File,
  ): Promise<ResidentDocument> {
    await this.findOne(residentId);

    const existing = await this.docRepository.findOne({ where: { residentId, templateId } });

    if (existing?.signedFileUrl) {
      const filename = basename(existing.signedFileUrl);
      const oldPath = join(process.cwd(), 'uploads', 'documents', filename);
      try {
        await rename(oldPath, join(dirname(oldPath), `~${filename}`));
      } catch {
        // arquivo pode não existir no disco
      }
    }

    const signedFileUrl = `/uploads/documents/${file.filename}`;

    if (existing) {
      await this.docRepository.update(existing.id, { signedFileUrl });
      return this.docRepository.findOne({ where: { id: existing.id } }) as Promise<ResidentDocument>;
    }

    const doc = this.docRepository.create({ residentId, templateId, signedFileUrl });
    return this.docRepository.save(doc);
  }

  findAttachments(residentId: string): Promise<ResidentAttachment[]> {
    return this.attachmentRepository.find({
      where: { residentId },
      order: { createdAt: 'DESC' },
    });
  }

  async addAttachment(
    residentId: string,
    file: Express.Multer.File,
    originalFilename: string,
  ): Promise<ResidentAttachment> {
    await this.findOne(residentId);
    const attachment = this.attachmentRepository.create({
      residentId,
      filename: originalFilename,
      fileUrl: `/uploads/attachments/${file.filename}`,
    });
    return this.attachmentRepository.save(attachment);
  }

  async removeAttachment(residentId: string, attachmentId: string): Promise<void> {
    const attachment = await this.attachmentRepository.findOne({
      where: { id: attachmentId, residentId },
    });
    if (!attachment) throw new NotFoundException(`Attachment ${attachmentId} not found`);
    try {
      await unlink(join(process.cwd(), 'uploads', 'attachments', basename(attachment.fileUrl)));
    } catch {
      // arquivo pode não existir no disco
    }
    await this.attachmentRepository.delete(attachmentId);
  }
}
