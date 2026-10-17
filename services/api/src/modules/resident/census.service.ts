import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditAction, AuditTargetType, NotificationType, ResidentStatus, Role } from '@fonte/types';
import { AuditService, loadById } from '../audit/audit.service';
import { RESIDENT_AUDIT_FIELDS } from '../audit/audit-fields';
import { Resident } from './resident.entity';
import { ResidentService } from './resident.service';
import { CreateResidentDto } from './dto/create-resident.dto';
import { ConcludeCensusDto } from './dto/conclude-census.dto';
import { House } from '../house/house.entity';
import { Staff } from '../staff/staff.entity';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class CensusService {
  private readonly logger = new Logger(CensusService.name);

  constructor(
    @InjectRepository(Resident)
    private readonly residentRepo: Repository<Resident>,
    @InjectRepository(House)
    private readonly houseRepo: Repository<House>,
    @InjectRepository(Staff)
    private readonly staffRepo: Repository<Staff>,
    private readonly residentService: ResidentService,
    private readonly notifications: NotificationService,
    // Story 199 — último de propósito: os anteriores são contrato dos specs.
    private readonly audit: AuditService,
  ) {}

  /**
   * Coordenador adiciona um filho durante a contagem. Cria com status
   * CENSUS_ADDED (aguardando aprovação do ADM) e notifica o ADM.
   */
  async addResident(
    dto: CreateResidentDto,
    requesterUserId: string,
  ): Promise<Resident> {
    const resident = await this.residentService.create(
      { ...dto, status: ResidentStatus.CENSUS_ADDED },
      undefined,
      { auditAction: AuditAction.CENSUS_RESIDENT_ADD },
    );

    const [staff, house] = await Promise.all([
      this.staffRepo.findOne({ where: { userId: requesterUserId } }),
      // Censo sempre cria com casa (DTO exige fora de ARCHIVED); o guard só
      // satisfaz o tipo nullable da coluna.
      resident.houseId
        ? this.houseRepo.findOne({ where: { id: resident.houseId } })
        : Promise.resolve(null),
    ]);

    await this.notifySafely(() =>
      this.notifications.create({
        type: NotificationType.CENSUS_RESIDENT_ADDED,
        title: `Filho adicionado na contagem — ${house?.name ?? ''}`.trim(),
        body: `${staff?.name ?? 'Coordenador'} adicionou ${resident.name} durante a contagem.`,
        recipientRole: Role.ADMIN,
        link: `/houses/${resident.houseId}`,
        metadata: {
          residentId: resident.id,
          houseId: resident.houseId,
          houseName: house?.name ?? null,
          addedByName: staff?.name ?? null,
        },
      }),
    );

    return resident;
  }

  /**
   * Coordenador conclui a contagem. Emite notificação ao ADM; quando houver
   * filhos adicionados (CENSUS_ADDED), o ADM verá o botão de revisão.
   */
  async conclude(
    dto: ConcludeCensusDto,
    requesterUserId: string,
  ): Promise<{ addedCount: number }> {
    const house = await this.houseRepo.findOne({ where: { id: dto.houseId } });
    if (!house) throw new NotFoundException(`House ${dto.houseId} not found`);

    const addedCount = await this.residentRepo.count({
      where: { houseId: dto.houseId, status: ResidentStatus.CENSUS_ADDED },
    });
    const staff = await this.staffRepo.findOne({
      where: { userId: requesterUserId },
    });

    await this.notifySafely(() =>
      this.notifications.create({
        type: NotificationType.CENSUS_CONCLUDED,
        title: `Contagem concluída — ${house.name}`,
        body:
          addedCount > 0
            ? `${dto.confirmedCount}/${dto.total} confirmados. ${addedCount} filho(s) adicionado(s) aguardando revisão.`
            : `${dto.confirmedCount}/${dto.total} confirmados.`,
        recipientRole: Role.ADMIN,
        link: `/houses/${dto.houseId}`,
        metadata: {
          houseId: dto.houseId,
          houseName: house.name,
          addedCount,
          confirmedCount: dto.confirmedCount,
          total: dto.total,
          addedByName: staff?.name ?? null,
        },
      }),
    );

    // Story 199 — conclusão não altera linha de negócio: evento sem diff, com os
    // números informados pela contagem (sem dado pessoal).
    await this.audit.recordEvent({
      action: AuditAction.CENSUS_CONCLUDE,
      targetType: AuditTargetType.HOUSE,
      targetId: dto.houseId,
      houseId: dto.houseId,
      context: { confirmedCount: dto.confirmedCount, total: dto.total, addedCount },
    });

    return { addedCount };
  }

  /** Filhos adicionados na contagem aguardando aprovação do ADM. */
  async listPending(houseId: string): Promise<
    Array<{
      id: string;
      name: string;
      photoThumbUrl: string | null;
      entryDate: Date | null;
      createdAt: Date;
    }>
  > {
    const residents = await this.residentRepo.find({
      where: { houseId, status: ResidentStatus.CENSUS_ADDED },
      order: { createdAt: 'DESC' },
    });
    return residents.map((r) => ({
      id: r.id,
      name: r.name,
      photoThumbUrl: r.photoThumbUrl,
      entryDate: r.entryDate,
      createdAt: r.createdAt,
    }));
  }

  /** ADM aprova todos os CENSUS_ADDED da casa de uma vez (→ ACTIVE). */
  async approveAll(houseId: string): Promise<{ approved: number }> {
    const pending = await this.residentRepo.find({
      where: { houseId, status: ResidentStatus.CENSUS_ADDED },
    });
    for (const resident of pending) {
      // Reusa a transição padrão p/ ACTIVE (admission, recálculo, notificação).
      // Um evento por filho aprovado; a correlação (requisição) agrupa o lote.
      await this.residentService.update(
        resident.id,
        { status: ResidentStatus.ACTIVE },
        { auditAction: AuditAction.CENSUS_APPROVE },
      );
    }
    return { approved: pending.length };
  }

  /** ADM nega um filho adicionado na contagem (→ REJECTED_CENSUS). */
  async reject(residentId: string): Promise<Resident> {
    const resident = await this.residentRepo.findOne({ where: { id: residentId } });
    if (!resident) throw new NotFoundException(`Resident ${residentId} not found`);
    if (resident.status !== ResidentStatus.CENSUS_ADDED) {
      throw new ConflictException('Filho não está aguardando revisão da contagem');
    }
    await this.audit.track({
      action: AuditAction.CENSUS_REJECT,
      targetType: AuditTargetType.RESIDENT,
      targetId: residentId,
      fields: RESIDENT_AUDIT_FIELDS,
      load: loadById(Resident),
      lockTable: 'residents',
      write: (m) =>
        m.getRepository(Resident).update(residentId, { status: ResidentStatus.REJECTED_CENSUS }),
    });
    return this.residentRepo.findOne({ where: { id: residentId } }) as Promise<Resident>;
  }

  private async notifySafely(fn: () => Promise<unknown>): Promise<void> {
    try {
      await fn();
    } catch (error) {
      this.logger.warn(
        `Falha ao emitir notificação de contagem: ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }
}
