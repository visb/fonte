import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Role } from '@fonte/types';
import { Resident } from './resident.entity';
import { Admission } from './admission.entity';
import { User } from '../user/user.entity';

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
import { ListResidentsDto } from './dto/list-residents.dto';
import { ReadmitResidentDto } from './dto/readmit-resident.dto';
import { UpdateResidentDto } from './dto/update-resident.dto';
import { StorageService } from '../storage/storage.service';

export interface ResidentMeView {
  id: string;
  name: string;
  houseId: string;
  userId: string;
  photoUrl: string | null;
}

@Injectable()
export class ResidentService {
  private static readonly ADMISSION_FIELDS = new Set<string>([
    'houseId', 'ministryId', 'entryDate', 'exitDate', 'status',
    'healthIssues', 'continuousMedication', 'weight', 'height', 'familyInvestment',
  ]);

  constructor(
    @InjectRepository(Resident)
    private residentRepository: Repository<Resident>,
    @InjectRepository(ResidentDocument)
    private docRepository: Repository<ResidentDocument>,
    @InjectRepository(ResidentAttachment)
    private attachmentRepository: Repository<ResidentAttachment>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Admission)
    private admissionRepository: Repository<Admission>,
    private storageService: StorageService,
  ) {}

  async findAll(dto: ListResidentsDto): Promise<{ data: Resident[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 20, search, status } = dto;

    const qb = this.residentRepository
      .createQueryBuilder('resident')
      .leftJoinAndSelect('resident.house', 'house')
      .leftJoinAndSelect('resident.ministry', 'ministry')
      .leftJoinAndSelect('resident.user', 'user')
      .orderBy('resident.name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    if (search) {
      const digits = search.replace(/\D/g, '');
      if (digits.length > 0) {
        qb.andWhere(
          `(LOWER(resident.name) LIKE LOWER(:search)
            OR REPLACE(REPLACE(resident.cpf, '.', ''), '-', '') LIKE :cpfSearch)`,
          { search: `%${search}%`, cpfSearch: `%${digits}%` },
        );
      } else {
        qb.andWhere('LOWER(resident.name) LIKE LOWER(:search)', { search: `%${search}%` });
      }
    }

    if (status) {
      qb.andWhere('resident.status = :status', { status });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<Resident> {
    const resident = await this.residentRepository.findOne({
      where: { id },
      relations: ['house', 'ministry', 'user'],
    });
    if (!resident) throw new NotFoundException(`Resident ${id} not found`);
    return resident;
  }

  async create(dto: CreateResidentDto): Promise<Resident> {
    const resident = this.residentRepository.create(dto);
    const saved = await this.residentRepository.save(resident);

    const admission = this.admissionRepository.create({
      residentId: saved.id,
      houseId: saved.houseId,
      ministryId: saved.ministryId ?? null,
      entryDate: saved.entryDate,
      exitDate: saved.exitDate ?? null,
      status: saved.status,
      healthIssues: saved.healthIssues ?? null,
      continuousMedication: saved.continuousMedication ?? null,
      weight: saved.weight ?? null,
      height: saved.height ?? null,
      familyInvestment: saved.familyInvestment ?? null,
    });
    await this.admissionRepository.save(admission);

    return saved;
  }

  async update(id: string, dto: UpdateResidentDto): Promise<Resident> {
    await this.findOne(id);
    await this.residentRepository.update(id, dto);

    const admissionUpdate = Object.fromEntries(
      Object.entries(dto).filter(([key]) => ResidentService.ADMISSION_FIELDS.has(key)),
    );
    if (Object.keys(admissionUpdate).length > 0) {
      const currentAdmission = await this.admissionRepository.findOne({
        where: { residentId: id },
        order: { createdAt: 'DESC' },
      });
      if (currentAdmission) {
        await this.admissionRepository.update(currentAdmission.id, admissionUpdate);
      }
    }

    return this.findOne(id);
  }

  async readmit(id: string, dto: ReadmitResidentDto): Promise<Resident> {
    const resident = await this.findOne(id);

    if (
      resident.status !== 'DISCHARGED' &&
      resident.status !== 'EVADED'
    ) {
      throw new BadRequestException(
        'Apenas acolhidos com status Alta ou Evasão podem ser reintroduzidos.',
      );
    }

    // Revogar acesso digital do acolhimento anterior
    if (resident.userId) {
      await this.residentRepository.update(id, { userId: null });
      await this.userRepository.softDelete(resident.userId);
    }

    // Criar novo registro de acolhimento
    const today = new Date().toISOString().split('T')[0];
    const admission = this.admissionRepository.create({
      residentId: id,
      houseId: dto.houseId,
      ministryId: null,
      entryDate: (dto.entryDate ?? today) as unknown as Date,
      exitDate: null,
      status: 'PRE_ADMISSION',
      healthIssues: dto.healthIssues ?? null,
      continuousMedication: dto.continuousMedication ?? null,
      weight: dto.weight ?? null,
      height: dto.height ?? null,
      familyInvestment: dto.familyInvestment ?? null,
    });
    await this.admissionRepository.save(admission);

    // Resetar campos de admissão no Resident (backward compat)
    const residentUpdate: Partial<Resident> = {
      houseId: dto.houseId,
      entryDate: (dto.entryDate ?? today) as unknown as Date,
      exitDate: null,
      status: 'PRE_ADMISSION' as Resident['status'],
      ministryId: null,
      userId: null,
      photoUrl: null,
      healthIssues: dto.healthIssues ?? null,
      continuousMedication: dto.continuousMedication ?? null,
      weight: dto.weight ?? null,
      height: dto.height ?? null,
      familyInvestment: dto.familyInvestment ?? null,
    };

    if (dto.address !== undefined) residentUpdate.address = dto.address;
    if (dto.contactPhone !== undefined) residentUpdate.contactPhone = dto.contactPhone;
    if (dto.email !== undefined) residentUpdate.email = dto.email;
    if (dto.maritalStatus !== undefined) residentUpdate.maritalStatus = dto.maritalStatus;
    if (dto.children !== undefined) residentUpdate.children = dto.children;
    if (dto.occupation !== undefined) residentUpdate.occupation = dto.occupation;
    if (dto.education !== undefined) residentUpdate.education = dto.education;
    if (dto.religion !== undefined) residentUpdate.religion = dto.religion;
    if (dto.addiction !== undefined) residentUpdate.addiction = dto.addiction;

    await this.residentRepository.update(id, residentUpdate);
    return this.findOne(id);
  }

  async findAdmissions(residentId: string): Promise<Admission[]> {
    await this.findOne(residentId);
    return this.admissionRepository.find({
      where: { residentId },
      relations: ['house'],
      order: { createdAt: 'DESC' },
    });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.residentRepository.softDelete(id);
  }

  async findMe(userId: string): Promise<ResidentMeView> {
    const resident = await this.residentRepository.findOne({
      where: { userId },
      relations: ['house'],
    });
    if (!resident) throw new NotFoundException('Perfil de interno não encontrado');
    return {
      id: resident.id,
      name: resident.name,
      houseId: resident.houseId,
      userId: resident.userId!,
      photoUrl: resident.photoUrl,
    };
  }

  async generateAccess(id: string, email: string, password: string): Promise<Resident> {
    const resident = await this.findOne(id);
    if (resident.userId) throw new ConflictException('Acesso já gerado para este interno');

    const existing = await this.userRepository.findOne({ where: { email } });
    if (existing) throw new ConflictException('E-mail já cadastrado');

    const passwordHash = await bcrypt.hash(password, 10);
    const user = this.userRepository.create({
      email,
      passwordHash,
      role: Role.RESIDENT,
      mustChangePassword: true,
    });
    const savedUser = await this.userRepository.save(user);
    await this.residentRepository.update(id, { userId: savedUser.id });
    return this.findOne(id);
  }

  async resetPassword(id: string, password: string): Promise<void> {
    const resident = await this.residentRepository.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!resident) throw new NotFoundException(`Resident ${id} not found`);
    if (!resident.userId || !resident.user) throw new NotFoundException('Acesso não gerado para este interno');

    const passwordHash = await bcrypt.hash(password, 10);
    await this.userRepository.update(resident.userId, { passwordHash, mustChangePassword: true });
  }

  async uploadPhotoMe(userId: string, file: Express.Multer.File): Promise<ResidentMeView> {
    const resident = await this.residentRepository.findOne({ where: { userId } });
    if (!resident) throw new NotFoundException('Perfil de interno não encontrado');
    await this.uploadPhoto(resident.id, file);
    return this.findMe(userId);
  }

  async uploadPhoto(residentId: string, file: Express.Multer.File): Promise<Resident> {
    const resident = await this.findOne(residentId);
    if (resident.photoUrl) {
      await this.storageService.delete(resident.photoUrl);
    }
    const filename = this.storageService.uniqueFilename(file.originalname);
    const url = await this.storageService.upload('residents', filename, file.buffer, file.mimetype);
    await this.residentRepository.update(residentId, { photoUrl: url });
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
      await this.storageService.delete(existing.signedFileUrl);
    }

    const filename = this.storageService.uniqueFilename(file.originalname, 'signed_');
    const signedFileUrl = await this.storageService.upload('documents', filename, file.buffer, file.mimetype);

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
    const filename = this.storageService.uniqueFilename(originalFilename);
    const fileUrl = await this.storageService.upload('attachments', filename, file.buffer, file.mimetype);
    const attachment = this.attachmentRepository.create({ residentId, filename: originalFilename, fileUrl });
    return this.attachmentRepository.save(attachment);
  }

  async removeAttachment(residentId: string, attachmentId: string): Promise<void> {
    const attachment = await this.attachmentRepository.findOne({
      where: { id: attachmentId, residentId },
    });
    if (!attachment) throw new NotFoundException(`Attachment ${attachmentId} not found`);
    await this.storageService.delete(attachment.fileUrl);
    await this.attachmentRepository.delete(attachmentId);
  }
}
