import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
// require form: tsconfig lacks esModuleInterop, so `import sharp from 'sharp'`
// emits an undefined default for sharp's CommonJS module.
const sharp = require('sharp') as typeof import('sharp');
import { ContributionReportItem, ContributionsReportResponse, FamilyInvestment, FollowUpType, ResidentStatus, Role, ServantRank } from '@fonte/types';
import { GetContributionsReportDto } from './dto/get-contributions-report.dto';

const CANONICAL_AMOUNTS: Partial<Record<FamilyInvestment, number>> = {
  [FamilyInvestment.BASKET_500]: 500,
  [FamilyInvestment.PAYMENT_700]: 700,
  [FamilyInvestment.SOCIAL]: 0,
};
import { Resident } from './resident.entity';
import { Admission } from './admission.entity';
import { User } from '../user/user.entity';
import { ResidentFollowUpService } from '../resident-follow-up/resident-follow-up.service';
import { ResidentReceivableService } from '../resident-receivable/resident-receivable.service';
import { UpdateContributionPlanDto } from '../resident-receivable/dto/update-contribution-plan.dto';
import { StaffService } from '../staff/staff.service';
import { Staff } from '../staff/staff.entity';
import { PromoteToServantDto } from './dto/promote-to-servant.dto';

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
  photoThumbUrl: string | null;
}

@Injectable()
export class ResidentService {
  private static readonly ADMISSION_FIELDS = new Set<string>([
    'houseId', 'ministryId', 'entryDate', 'exitDate', 'status',
    'healthIssues', 'continuousMedication', 'weight', 'height',
    'familyInvestment', 'familyInvestmentAmount',
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
    private followUpService: ResidentFollowUpService,
    private receivableService: ResidentReceivableService,
    private staffService: StaffService,
    private dataSource: DataSource,
  ) {}

  async findAll(dto: ListResidentsDto): Promise<{ data: Resident[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 20, search, status, houseId } = dto;

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

    if (houseId) {
      qb.andWhere('resident.houseId = :houseId', { houseId });
    }

    if (dto.overdueContribution) {
      const activeStatuses = [
        ResidentStatus.PRE_ADMISSION,
        ResidentStatus.ACTIVE,
        ResidentStatus.DISCIPLINE,
        ResidentStatus.TEMP_LEAVE,
      ];
      qb.andWhere('resident.contributionExempt = false')
        .andWhere('resident.status IN (:...overdActiveStatuses)', { overdActiveStatuses: activeStatuses })
        .andWhere(
          `EXISTS (
            SELECT 1 FROM resident_receivables rcv
            WHERE rcv.resident_id = resident.id
              AND rcv.mandatory = true
              AND rcv.status = 'PENDING'
              AND rcv.due_date < CURRENT_DATE
              AND rcv.deleted_at IS NULL
          )`,
        );
    }

    const [data, total] = await qb.getManyAndCount();
    if (data.length > 0) {
      const map = await this.receivableService.getLastPaidDates(data.map((r) => r.id));
      for (const r of data) r.lastContributionDate = map.get(r.id) ?? null;
    }
    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<Resident> {
    const resident = await this.residentRepository.findOne({
      where: { id },
      relations: ['house', 'ministry', 'user'],
    });
    if (!resident) throw new NotFoundException(`Resident ${id} not found`);
    const map = await this.followUpService.getLastContributionDates([id]);
    resident.lastContributionDate = map.get(id) ?? null;
    return resident;
  }

  private resolveInvestmentAmount<T extends { familyInvestment?: FamilyInvestment | null; familyInvestmentAmount?: number | null }>(dto: T): T {
    if (dto.familyInvestment && dto.familyInvestment !== FamilyInvestment.NEGOTIATED) {
      dto.familyInvestmentAmount = CANONICAL_AMOUNTS[dto.familyInvestment] ?? null;
    }
    return dto;
  }

  async create(dto: CreateResidentDto): Promise<Resident> {
    this.resolveInvestmentAmount(dto);
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
      familyInvestmentAmount: saved.familyInvestmentAmount ?? null,
    });
    await this.admissionRepository.save(admission);

    const admissionDate = saved.entryDate
      ? new Date(saved.entryDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];
    await this.followUpService.createAuto(saved.id, FollowUpType.ADMISSION, admissionDate);

    await this.receivableService.generateSchedule(saved.id);

    return saved;
  }

  async update(id: string, dto: UpdateResidentDto): Promise<Resident> {
    this.resolveInvestmentAmount(dto);
    const before = await this.findOne(id);
    await this.residentRepository.update(id, dto);

    const today = new Date().toISOString().split('T')[0];
    // Exit-driven events (discharge/evasion) are dated by the actual exit date
    // when provided, falling back to today.
    const exitEventDate = (dto.exitDate as string | undefined) ?? today;
    if (dto.status === 'DISCHARGED' && before.status !== 'DISCHARGED') {
      await this.followUpService.createAuto(id, FollowUpType.DISCHARGE, exitEventDate);
      await this.receivableService.cancelAfterExit(id, exitEventDate);
    } else if (dto.status === 'EVADED' && before.status !== 'EVADED') {
      await this.followUpService.createAuto(id, FollowUpType.EVASION, exitEventDate);
      await this.receivableService.cancelAfterExit(id, exitEventDate);
    }
    if (dto.ministryId !== undefined && dto.ministryId !== before.ministryId) {
      await this.followUpService.createAuto(id, FollowUpType.MINISTRY_CHANGE, today);
    }

    // Keep the carnê in sync when contribution-relevant fields change via the edit form.
    const contributionTouched =
      dto.familyInvestment !== undefined ||
      dto.familyInvestmentAmount !== undefined ||
      dto.contributionDueDay !== undefined ||
      dto.entryDate !== undefined;
    if (contributionTouched) {
      await this.receivableService.recalcFuturePending(id);
    }

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
    this.resolveInvestmentAmount(dto);
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
      familyInvestmentAmount: dto.familyInvestmentAmount ?? null,
    });
    await this.admissionRepository.save(admission);

    const readmitDate = dto.entryDate ?? new Date().toISOString().split('T')[0];
    await this.followUpService.createAuto(id, FollowUpType.READMISSION, readmitDate as string);

    // Resetar campos de admissão no Resident (backward compat)
    const residentUpdate: Partial<Resident> = {
      houseId: dto.houseId,
      entryDate: (dto.entryDate ?? today) as unknown as Date,
      exitDate: null,
      status: 'PRE_ADMISSION' as Resident['status'],
      ministryId: null,
      userId: null,
      photoUrl: null,
      photoThumbUrl: null,
      healthIssues: dto.healthIssues ?? null,
      continuousMedication: dto.continuousMedication ?? null,
      weight: dto.weight ?? null,
      height: dto.height ?? null,
      familyInvestment: dto.familyInvestment ?? null,
      familyInvestmentAmount: dto.familyInvestmentAmount ?? null,
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
    if (dto.contributionDueDay !== undefined) residentUpdate.contributionDueDay = dto.contributionDueDay;

    await this.residentRepository.update(id, residentUpdate);

    await this.receivableService.generateSchedule(id);

    return this.findOne(id);
  }

  async updateContributionPlan(id: string, dto: UpdateContributionPlanDto): Promise<Resident> {
    await this.findOne(id);
    const update: Partial<Resident> = { familyInvestment: dto.familyInvestment };
    update.familyInvestmentAmount =
      dto.familyInvestment === FamilyInvestment.NEGOTIATED
        ? (dto.familyInvestmentAmount ?? null)
        : (CANONICAL_AMOUNTS[dto.familyInvestment] ?? null);
    if (dto.contributionDueDay !== undefined) update.contributionDueDay = dto.contributionDueDay;

    await this.residentRepository.update(id, update);
    await this.receivableService.recalcFuturePending(id);
    return this.findOne(id);
  }

  async setContributionExempt(id: string, exempt: boolean): Promise<Resident> {
    await this.findOne(id);
    await this.residentRepository.update(id, { contributionExempt: exempt });
    if (exempt) {
      await this.receivableService.cancelFuturePending(id);
    } else {
      await this.receivableService.generateSchedule(id);
    }
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
      photoThumbUrl: resident.photoThumbUrl,
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

  // Promove um filho (Resident) a servo (Staff): reaproveita o User do kiosk se
  // houver (troca role para SERVANT) ou cria um novo acesso, cria o Staff como
  // ASPIRANTE vinculado ao Resident, e arquiva o filho (alta).
  async promoteToServant(id: string, dto: PromoteToServantDto): Promise<Staff> {
    const resident = await this.findOne(id);

    if (await this.staffService.existsForFormerResident(id)) {
      throw new ConflictException('Este interno já foi promovido a servo');
    }

    let userId: string;
    if (resident.userId) {
      // Reaproveita a conta de kiosk: mantém email/senha, vira SERVANT.
      await this.userRepository.update(resident.userId, { role: Role.SERVANT });
      userId = resident.userId;
    } else {
      if (!dto.password) {
        throw new BadRequestException('Senha é obrigatória para gerar o acesso do servo');
      }
      const email = dto.email || null;
      if (email) {
        const existing = await this.userRepository.findOne({ where: { email } });
        if (existing) throw new ConflictException('E-mail já cadastrado');
      }

      const passwordHash = await bcrypt.hash(dto.password, 10);
      const savedUser = await this.userRepository.save(
        this.userRepository.create({
          email,
          passwordHash,
          role: Role.SERVANT,
          mustChangePassword: true,
        }),
      );
      userId = savedUser.id;
    }

    const promotedAt = dto.date ?? new Date().toISOString().split('T')[0];

    const staff = await this.staffService.createFromResident({
      name: resident.name,
      phone: resident.contactPhone,
      houseId: dto.houseId ?? resident.houseId,
      photoUrl: resident.photoUrl,
      userId,
      formerResidentId: resident.id,
      rank: dto.rank ?? ServantRank.ASPIRANTE,
      promotedAt,
    });

    // Arquiva o filho: alta + evento na timeline na data da promoção.
    await this.residentRepository.update(id, {
      status: ResidentStatus.DISCHARGED,
      exitDate: promotedAt as unknown as Date,
    });
    await this.followUpService.createAuto(id, FollowUpType.PROMOTED_TO_SERVANT, promotedAt);

    // Recarrega com as relações (user/house) para a resposta.
    return this.staffService.findOne(staff.id);
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

  static readonly PHOTO_THUMB_SIZE = 70;

  // Generates a square cropped thumbnail (PHOTO_THUMB_SIZE px) as JPEG.
  private static async makePhotoThumbnail(buffer: Buffer): Promise<Buffer> {
    return sharp(buffer)
      .rotate()
      .resize(ResidentService.PHOTO_THUMB_SIZE, ResidentService.PHOTO_THUMB_SIZE, {
        fit: 'cover',
        position: 'centre',
      })
      .jpeg({ quality: 80 })
      .toBuffer();
  }

  async uploadPhoto(residentId: string, file: Express.Multer.File): Promise<Resident> {
    const resident = await this.findOne(residentId);
    if (resident.photoUrl) {
      await this.storageService.delete(resident.photoUrl);
    }
    if (resident.photoThumbUrl) {
      await this.storageService.delete(resident.photoThumbUrl);
    }

    const filename = this.storageService.uniqueFilename(file.originalname);
    const url = await this.storageService.upload('residents', filename, file.buffer, file.mimetype);

    const thumbBuffer = await ResidentService.makePhotoThumbnail(file.buffer);
    const thumbFilename = this.storageService.uniqueFilename('thumb.jpg', 'thumb_');
    const thumbUrl = await this.storageService.upload('residents', thumbFilename, thumbBuffer, 'image/jpeg');

    await this.residentRepository.update(residentId, { photoUrl: url, photoThumbUrl: thumbUrl });
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
    const displayName = this.storageService.decodeOriginalName(originalFilename);
    const filename = this.storageService.uniqueFilename(displayName);
    const fileUrl = await this.storageService.upload('attachments', filename, file.buffer, file.mimetype);
    const attachment = this.attachmentRepository.create({ residentId, filename: displayName, fileUrl });
    const saved = await this.attachmentRepository.save(attachment);
    await this.followUpService.createAuto(residentId, FollowUpType.DOCUMENT_ATTACHED);
    return saved;
  }

  async removeAttachment(residentId: string, attachmentId: string): Promise<void> {
    const attachment = await this.attachmentRepository.findOne({
      where: { id: attachmentId, residentId },
    });
    if (!attachment) throw new NotFoundException(`Attachment ${attachmentId} not found`);
    await this.storageService.delete(attachment.fileUrl);
    await this.attachmentRepository.delete(attachmentId);
  }

  async getContributionsReport(dto: GetContributionsReportDto): Promise<ContributionsReportResponse> {
    const monthDate = `${dto.month}-01`;

    let sql = `
      SELECT
        r.id            AS "residentId",
        r.name          AS "residentName",
        r.house_id      AS "houseId",
        h.name          AS "houseName",
        rcv.family_investment           AS "familyInvestment",
        rcv.amount                      AS "expectedAmount",
        rcv.paid_amount                 AS "collectedAmount",
        (rcv.status = 'PAID')           AS paid,
        rcv.paid_at                     AS "paidAt"
      FROM residents r
      INNER JOIN houses h ON h.id = r.house_id
      INNER JOIN resident_receivables rcv
        ON  rcv.resident_id = r.id
        AND rcv.mandatory = true
        AND rcv.status != 'CANCELED'
        AND DATE_TRUNC('month', rcv.reference_month) = DATE_TRUNC('month', $1::date)
        AND rcv.deleted_at IS NULL
      WHERE r.contribution_exempt = false
        AND r.status IN ('PRE_ADMISSION','ACTIVE','DISCIPLINE','TEMP_LEAVE')
        AND r.deleted_at IS NULL
    `;

    const params: unknown[] = [monthDate];

    if (dto.houseId) {
      params.push(dto.houseId);
      sql += ` AND r.house_id = $${params.length}`;
    }

    sql += ' ORDER BY r.name ASC';

    const rows: ContributionReportItem[] = await this.dataSource.query(sql, params);

    const items: ContributionReportItem[] = rows.map((row) => ({
      ...row,
      paid: row.paid === true || (row.paid as unknown) === 't' || (row.paid as unknown) === 'true',
      expectedAmount: row.expectedAmount != null ? Number(row.expectedAmount) : (CANONICAL_AMOUNTS[row.familyInvestment as FamilyInvestment] ?? 0),
      collectedAmount: row.collectedAmount != null ? Number(row.collectedAmount) : null,
    }));

    const totalResidents = items.length;
    const totalPaid = items.filter((i) => i.paid).length;
    const totalPending = totalResidents - totalPaid;
    const totalExpectedAmount = items.reduce((sum, i) => sum + (i.expectedAmount ?? 0), 0);
    const totalCollectedAmount = items
      .filter((i) => i.paid)
      .reduce((sum, i) => sum + (i.collectedAmount ?? i.expectedAmount ?? 0), 0);

    return {
      month: dto.month,
      items,
      totalResidents,
      totalPaid,
      totalPending,
      totalExpectedAmount,
      totalCollectedAmount,
    };
  }
}
