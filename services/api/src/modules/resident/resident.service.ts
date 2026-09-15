import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
// require form: tsconfig lacks esModuleInterop, so `import sharp from 'sharp'`
// emits an undefined default for sharp's CommonJS module.
const sharp = require('sharp') as typeof import('sharp');
import { ACTIVE_RESIDENT_STATUSES, ContributionReportItem, ContributionsReportResponse, FamilyInvestment, FollowUpType, isTemplateAvailableForStatus, NotificationType, PRESENT_RESIDENT_STATUSES, ResidentStatus, Role, ServantRank, TemplateAvailability } from '@fonte/types';
import { Logger } from '@nestjs/common';
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
import { NotificationService } from '../notification/notification.service';
import { PromoteToServantDto } from './dto/promote-to-servant.dto';

export interface ResidentDocumentView {
  id: string;
  residentId: string;
  templateId: string;
  templateName: string;
  signAtAdmission: boolean;
  signed: boolean;
  signedFileUrl: string | null;
  signedAt: Date | null;
  withinWindow: boolean;
}

// Documento de acolhimento a assinar: combina o template marcado
// signAtAdmission com o status de assinatura do interno. Inclui o caminho do
// PDF preenchido (gerado on-demand) para impressão/assinatura.
export interface AdmissionDocumentView {
  templateId: string;
  templateName: string;
  signed: boolean;
  signedFileUrl: string | null;
  signedAt: Date | null;
  pdfPath: string;
}
import { ResidentAttachment } from './resident-attachment.entity';
import { ResidentDocument } from './resident-document.entity';
import { CreateResidentDto } from './dto/create-resident.dto';
import { ListResidentsDto, ResidentSortField } from './dto/list-residents.dto';
import { ReadmitResidentDto } from './dto/readmit-resident.dto';
import { UpdateResidentDto } from './dto/update-resident.dto';
import { UpdateResidentIdentityDto } from './dto/update-resident-identity.dto';
import { StorageService } from '../storage/storage.service';
import { toDbTimestamp } from '../../common/lib/db-timestamp';

export interface ResidentMeView {
  id: string;
  name: string;
  // Nulo só em ARCHIVED — que nunca recebe acesso, mas o tipo acompanha a coluna.
  houseId: string | null;
  userId: string;
  photoUrl: string | null;
  photoThumbUrl: string | null;
}

@Injectable()
export class ResidentService {
  private readonly logger = new Logger(ResidentService.name);

  private static readonly ADMISSION_FIELDS = new Set<string>([
    'houseId', 'entryDate', 'exitDate', 'status',
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
    private notifications: NotificationService,
  ) {}

  async findAll(
    dto: ListResidentsDto,
    caller?: { role: string; userId: string },
  ): Promise<{ data: Resident[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 20, search, status, sort = 'name', order = 'asc' } = dto;
    let { houseId } = dto;

    // LGPD art. 6/46 — escopo por casa. Não-ADMIN só enxerga internos da própria
    // casa; o houseId é derivado do staff autenticado, nunca do parâmetro de
    // consulta (que seria adulterável).
    if (caller && caller.role !== Role.ADMIN) {
      const staff = await this.staffService.findByUserId(caller.userId).catch(() => null);
      if (!staff?.houseId) return { data: [], total: 0, page, limit };
      houseId = staff.houseId;
    }

    // Ordenação whitelisted (story 129, decisão 5): mapeia o campo validado
    // pelo DTO para a coluna, nunca interpola o valor recebido no orderBy.
    const SORT_COLUMNS: Record<ResidentSortField, string> = {
      name: 'resident.name',
      entryDate: 'resident.entryDate',
    };
    const direction = order === 'desc' ? 'DESC' : 'ASC';

    const qb = this.residentRepository
      .createQueryBuilder('resident')
      .leftJoinAndSelect('resident.house', 'house')
      .leftJoinAndSelect('resident.user', 'user')
      // NULLS LAST: filho sem entry_date (ex.: ARCHIVED) vai para o fim nas
      // duas direções (decisão 4). Desempate por id garante paginação estável
      // do infinite scroll com datas repetidas (decisão 3).
      .orderBy(SORT_COLUMNS[sort], direction, 'NULLS LAST')
      .addOrderBy('resident.id', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    if (search) {
      const digits = search.replace(/\D/g, '');
      if (digits.length > 0) {
        qb.andWhere(
          `(unaccent(LOWER(resident.name)) LIKE unaccent(LOWER(:search))
            OR REPLACE(REPLACE(resident.cpf, '.', ''), '-', '') LIKE :cpfSearch)`,
          { search: `%${search}%`, cpfSearch: `%${digits}%` },
        );
      } else {
        qb.andWhere('unaccent(LOWER(resident.name)) LIKE unaccent(LOWER(:search))', {
          search: `%${search}%`,
        });
      }
    }

    if (status) {
      qb.andWhere('resident.status = :status', { status });
    }

    if (houseId) {
      qb.andWhere('resident.houseId = :houseId', { houseId });
    }

    if (dto.overdueContribution) {
      // Story 160 — definição ÚNICA de "filho ativo", vinda de @fonte/types.
      const activeStatuses = ACTIVE_RESIDENT_STATUSES;
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

  /**
   * Filhos **presentes** da casa para o snapshot offline (story 177).
   *
   * `since` recorta o delta por `updated_at` — quem não mudou não desce de novo.
   * Sem `since`, devolve o conjunto completo. Só `PRESENT_RESIDENT_STATUSES`
   * entra: quem saiu ou foi arquivado não vai para o aparelho (LGPD art. 6 —
   * minimização; menos dado pessoal parado no dispositivo do operador).
   *
   * A relação `user` fica **fora** de propósito: o snapshot não precisa da conta
   * de acesso do filho e o hash de senha não tem por que trafegar num payload
   * que é gravado em disco no celular.
   */
  async findPresentByHouse(houseId: string, since?: Date): Promise<Resident[]> {
    const qb = this.residentRepository
      .createQueryBuilder('resident')
      .leftJoinAndSelect('resident.house', 'house')
      .where('resident.house_id = :houseId', { houseId })
      .andWhere('resident.status IN (:...statuses)', {
        statuses: [...PRESENT_RESIDENT_STATUSES],
      })
      .andWhere('resident.deleted_at IS NULL')
      .orderBy('resident.name', 'ASC');

    if (since) qb.andWhere('resident.updated_at > :since', { since: toDbTimestamp(since) });

    return qb.getMany();
  }

  /**
   * Só os ids dos filhos presentes da casa (story 177). O delta usa isto para
   * buscar os blocos de detalhe: um evento novo na timeline **não** altera a
   * linha do filho, então recortar o detalhe pela lista de filhos alterados
   * esconderia o lançamento até a próxima sincronização completa.
   */
  async findPresentIdsByHouse(houseId: string): Promise<string[]> {
    const rows = await this.residentRepository
      .createQueryBuilder('resident')
      .select('resident.id', 'id')
      .where('resident.house_id = :houseId', { houseId })
      .andWhere('resident.status IN (:...statuses)', {
        statuses: [...PRESENT_RESIDENT_STATUSES],
      })
      .andWhere('resident.deleted_at IS NULL')
      .getRawMany<{ id: string }>();
    return rows.map((row) => row.id);
  }

  /**
   * Filhos que o aparelho precisa **apagar** desde `since` (story 177): os
   * excluídos (soft delete) e os que deixaram `PRESENT_RESIDENT_STATUSES` (alta,
   * evasão, arquivamento). Sem isso a ficha sobrevive no celular para sempre.
   *
   * Transferência para outra casa não é detectável aqui (a linha já aponta para
   * a casa nova e o `house_id` anterior não é guardado) — é um dos buracos que
   * a sincronização completa periódica fecha.
   */
  async findDepartedIdsSince(houseId: string, since: Date): Promise<string[]> {
    const rows = await this.residentRepository
      .createQueryBuilder('resident')
      .select('resident.id', 'id')
      .withDeleted()
      .where('resident.house_id = :houseId', { houseId })
      .andWhere(
        `(resident.deleted_at > :since
          OR (resident.deleted_at IS NULL
              AND resident.updated_at > :since
              AND resident.status NOT IN (:...statuses)))`,
        { since: toDbTimestamp(since), statuses: [...PRESENT_RESIDENT_STATUSES] },
      )
      .getRawMany<{ id: string }>();
    return rows.map((row) => row.id);
  }

  /**
   * Anexos de N filhos numa consulta só (story 177). `resident_attachments` não
   * tem `updated_at` nem `deleted_at`, então não há delta possível: o snapshot
   * manda o conjunto completo de cada filho que aparece no payload.
   */
  async findAttachmentsByResidents(residentIds: string[]): Promise<ResidentAttachment[]> {
    if (residentIds.length === 0) return [];
    return this.attachmentRepository.find({
      where: { residentId: In(residentIds) },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Resident> {
    const resident = await this.residentRepository.findOne({
      where: { id },
      relations: ['house', 'user'],
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

  // `manager` opcional permite rodar a criação inteira (resident + admissão +
  // evento de acolhimento + carnê) dentro de uma transação externa (ex.: commit
  // do import em lote, story 103). Sem ele, cada repositório injetado auto-commita
  // como antes.
  async create(dto: CreateResidentDto, manager?: EntityManager): Promise<Resident> {
    this.resolveInvestmentAmount(dto);
    const residentRepo = manager ? manager.getRepository(Resident) : this.residentRepository;
    const admissionRepo = manager ? manager.getRepository(Admission) : this.admissionRepository;

    const resident = residentRepo.create(dto);
    const saved = await residentRepo.save(resident);

    const admission = admissionRepo.create({
      residentId: saved.id,
      // Sem casa (ARCHIVED do import): acolhimento registrado sem house.
      houseId: saved.houseId ?? null,
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
    await admissionRepo.save(admission);

    const admissionDate = saved.entryDate
      ? new Date(saved.entryDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];
    await this.followUpService.createAuto(saved.id, FollowUpType.ADMISSION, admissionDate, manager);

    await this.receivableService.generateSchedule(saved.id, manager);

    // Acolhimento manual já entra ACTIVE — notifica aqui. O import em lote passa
    // `manager` e fica silencioso para não inundar as notificações.
    if (!manager && saved.status === ResidentStatus.ACTIVE) {
      await this.notifyAdmissionCreated(saved);
    }

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
      await this.notifyResidentDischarged(before);
    } else if (dto.status === 'EVADED' && before.status !== 'EVADED') {
      await this.followUpService.createAuto(id, FollowUpType.EVASION, exitEventDate);
      await this.receivableService.cancelAfterExit(id, exitEventDate);
    }
    // Acolhimento concluído: transição para ACTIVE.
    if (dto.status === ResidentStatus.ACTIVE && before.status !== ResidentStatus.ACTIVE) {
      await this.notifyAdmissionCreated(before);
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
      const currentAdmission = await this.findCurrentAdmission(id);
      if (currentAdmission) {
        await this.admissionRepository.update(currentAdmission.id, admissionUpdate);
      }
    }

    return this.findOne(id);
  }

  // Correção dos "dados de identidade" na reintrodução (story 147). Diferente de
  // `update`, atualiza SÓ os 5 campos de identidade (nome, CPF, RG, nascimento,
  // gênero) — não toca em admissão, carnê, status nem eventos de acolhimento. A
  // rota é ADMIN-only (`@Roles(Role.ADMIN)`); aqui não há regra extra de status.
  async updateIdentity(id: string, dto: UpdateResidentIdentityDto): Promise<Resident> {
    // `findOne` valida a existência (lança NotFound) antes de gravar.
    await this.findOne(id);
    await this.residentRepository.update(id, dto);
    return this.findOne(id);
  }

  // Best-effort: a notification failure must never break the resident update.
  private async notifyAdmissionCreated(resident: Resident): Promise<void> {
    try {
      const metadata = { entityId: resident.id, residentId: resident.id };
      await this.notifications.create({
        type: NotificationType.ADMISSION_CREATED,
        title: 'Acolhimento concluído',
        body: `${resident.name} agora está ativo.`,
        link: `/residents/${resident.id}`,
        recipientRole: Role.ADMIN,
        metadata,
      });
      if (resident.houseId) {
        await this.notifications.create({
          type: NotificationType.ADMISSION_CREATED,
          title: 'Acolhimento concluído',
          body: `${resident.name} agora está ativo.`,
          link: `/residents/${resident.id}`,
          houseId: resident.houseId,
          metadata,
        });
      }
    } catch (error) {
      this.logger.warn(
        `Failed to emit ADMISSION_CREATED for ${resident.id}: ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }

  private async notifyResidentDischarged(resident: Resident): Promise<void> {
    try {
      const metadata = { entityId: resident.id, residentId: resident.id };
      await this.notifications.create({
        type: NotificationType.RESIDENT_DISCHARGED,
        title: 'Alta registrada',
        body: `${resident.name} recebeu alta.`,
        link: `/residents/${resident.id}`,
        recipientRole: Role.ADMIN,
        metadata,
      });
      if (resident.houseId) {
        await this.notifications.create({
          type: NotificationType.RESIDENT_DISCHARGED,
          title: 'Alta registrada',
          body: `${resident.name} recebeu alta.`,
          link: `/residents/${resident.id}`,
          houseId: resident.houseId,
          metadata,
        });
      }
    } catch (error) {
      this.logger.warn(
        `Failed to emit RESIDENT_DISCHARGED for ${resident.id}: ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
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
      entryDate: (dto.entryDate ?? today) as unknown as Date,
      exitDate: null,
      status: 'ACTIVE',
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
      status: ResidentStatus.ACTIVE as Resident['status'],
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

    // Reintrodução entra direto como ACTIVE: dispara a mesma notificação de
    // "acolhimento concluído" do fluxo normal PRE→ACTIVE. Best-effort — a falha
    // de notificação nunca quebra o readmit.
    await this.notifyAdmissionCreated(resident);

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

  /**
   * Acolhimento atual do filho (story 164, decisão 6): o de **maior entrada**,
   * `NULLS LAST`, desempatando por `created_at DESC`.
   *
   * Ordenar só por `created_at` era o bug: no import em lote os acolhimentos
   * antigos são gravados DEPOIS do atual, então `created_at DESC` devolvia o
   * mais ANTIGO — e editar a ficha escrevia na admissão errada.
   */
  async findCurrentAdmission(residentId: string): Promise<Admission | null> {
    return this.orderedAdmissionsQuery(residentId).limit(1).getOne();
  }

  async findAdmissions(residentId: string): Promise<Admission[]> {
    await this.findOne(residentId);
    // A ordem é contrato: o adm.fonte numera os acolhimentos e abre a aba
    // Contribuições no índice 0 (o atual).
    return this.orderedAdmissionsQuery(residentId).leftJoinAndSelect('adm.house', 'house').getMany();
  }

  // `NULLS LAST` não é expressável no `order` do TypeORM de forma portátil.
  private orderedAdmissionsQuery(residentId: string) {
    return this.admissionRepository
      .createQueryBuilder('adm')
      .where('adm.resident_id = :residentId', { residentId })
      .andWhere('adm.deleted_at IS NULL')
      .orderBy('adm.entry_date', 'DESC', 'NULLS LAST')
      .addOrderBy('adm.created_at', 'DESC');
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
      whatsapp: resident.contactPhone,
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

  // `manager` opcional: quando o resident foi criado dentro de uma transação
  // ainda não commitada (import em lote), o findOne/update precisam enxergá-lo
  // pela mesma transação. O upload ao bucket é I/O externo e não é transacional.
  async uploadPhoto(
    residentId: string,
    file: Express.Multer.File,
    manager?: EntityManager,
  ): Promise<Resident> {
    const repo = manager ? manager.getRepository(Resident) : this.residentRepository;
    const resident = manager
      ? await repo.findOne({ where: { id: residentId } })
      : await this.findOne(residentId);
    if (!resident) throw new NotFoundException(`Resident ${residentId} not found`);
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

    await repo.update(residentId, { photoUrl: url, photoThumbUrl: thumbUrl });
    return manager ? ((await repo.findOne({ where: { id: residentId } }))!) : this.findOne(residentId);
  }

  private static readonly SIGNED_EXPIRY_MS = 30 * 60 * 1000;

  async findDocuments(residentId: string): Promise<ResidentDocumentView[]> {
    const resident = await this.residentRepository.findOne({ where: { id: residentId } });
    const docs = await this.docRepository.find({
      where: { residentId },
      relations: ['template'],
      order: { template: { name: 'ASC' } },
    });
    const now = Date.now();
    // Story 160 — some com o documento cujo template não vale para o status do
    // filho: sem isto a aba de anexos continuaria listando por esta outra fonte
    // de dados o documento que o backend recusaria gerar.
    const visible = docs.filter((doc) =>
      isTemplateAvailableForStatus(doc.template?.availableFor, resident?.status),
    );
    return visible.map((doc) => {
      const withinWindow =
        !!doc.signedFileUrl &&
        now - new Date(doc.updatedAt).getTime() <= ResidentService.SIGNED_EXPIRY_MS;
      return {
        id: doc.id,
        residentId: doc.residentId,
        templateId: doc.templateId,
        templateName: doc.template?.name ?? '',
        signAtAdmission: doc.template?.signAtAdmission ?? false,
        signed: !!doc.signedFileUrl,
        signedFileUrl: doc.signedFileUrl,
        signedAt: doc.signedFileUrl ? doc.updatedAt : null,
        withinWindow,
      };
    });
  }

  // Lista os documentos de acolhimento (templates signAtAdmission) com o status
  // de assinatura do interno. `templates` vem do DocumentTemplateService para
  // não acoplar ResidentService ao repositório de templates.
  async findAdmissionDocuments(
    residentId: string,
    templates: { id: string; name: string; availableFor?: TemplateAvailability }[],
  ): Promise<AdmissionDocumentView[]> {
    const resident = await this.findOne(residentId);
    const docs = await this.docRepository.find({ where: { residentId } });
    // Story 160 — descarta os templates indisponíveis para o status do filho.
    const available = templates.filter((t) =>
      isTemplateAvailableForStatus(t.availableFor, resident.status),
    );
    return available.map((t) => {
      const doc = docs.find((d) => d.templateId === t.id);
      return {
        templateId: t.id,
        templateName: t.name,
        signed: !!doc?.signedFileUrl,
        signedFileUrl: doc?.signedFileUrl ?? null,
        signedAt: doc?.signedFileUrl ? doc.updatedAt : null,
        pdfPath: `/api/v1/residents/${residentId}/documents/${t.id}/pdf`,
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
