import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import {
  ADMISSION_EXIT_STATUSES,
  ADMISSION_HISTORY_MESSAGES,
  AuditAction,
  AuditTargetType,
  findAdmissionOverlap,
  ResidentStatus,
} from '@fonte/types';
import { Admission } from './admission.entity';
import { Resident } from './resident.entity';
import { House } from '../house/house.entity';
import { ResidentService } from './resident.service';
import { assertAdmissionDates } from './admission-dates';
import { CreateAdmissionDto } from './dto/create-admission.dto';
import { UpdateAdmissionDto } from './dto/update-admission.dto';
import { AuditService, defaultScope, loadById } from '../audit/audit.service';
import { ADMISSION_AUDIT_FIELDS, RESIDENT_AUDIT_FIELDS } from '../audit/audit-fields';

type DateValue = string | Date | null | undefined;

/** `YYYY-MM-DD` de um valor vindo do DTO (string) ou da entidade (Date/string). */
function isoDate(value: DateValue): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

interface Period {
  id: string;
  entryDate: string | null;
  exitDate: string | null;
}

function toPeriod(admission: Admission): Period {
  return {
    id: admission.id,
    entryDate: isoDate(admission.entryDate),
    exitDate: isoDate(admission.exitDate),
  };
}

/**
 * Story 215 — criação e correção de passagens pela aba Histórico (ADMIN).
 *
 * "Atual" é o acolhimento que a ficha espelha: o primeiro de
 * `ResidentService.findAdmissions` (maior entrada, story 164) — a mesma regra
 * que `update`/readmissão usam. Nele só a entrada muda (decisão 5); casa,
 * saída e status seguem pelas transições validadas da ficha.
 */
@Injectable()
export class AdmissionService {
  constructor(
    @InjectRepository(Admission)
    private admissionRepository: Repository<Admission>,
    @InjectRepository(House)
    private houseRepository: Repository<House>,
    private residentService: ResidentService,
    private audit: AuditService,
  ) {}

  async createAdmission(residentId: string, dto: CreateAdmissionDto): Promise<Admission> {
    const resident = await this.residentService.findOne(residentId);
    if (!dto.exitDate) throw new BadRequestException(ADMISSION_HISTORY_MESSAGES.exitDateRequired);
    this.assertExitStatus(dto.status);
    await this.assertHouse(dto.houseId ?? null, dto.status);
    assertAdmissionDates({ entryDate: dto.entryDate, exitDate: dto.exitDate });

    const admissions = await this.residentService.findAdmissions(residentId);
    const period = { entryDate: isoDate(dto.entryDate), exitDate: isoDate(dto.exitDate) };
    this.assertBeforeCurrent(period.entryDate, admissions[0], resident);
    this.assertNoOverlap(period, admissions);

    const saved = await this.audit.track<Admission>({
      action: AuditAction.ADMISSION_CREATE,
      targetType: AuditTargetType.ADMISSION,
      fields: ADMISSION_AUDIT_FIELDS,
      load: loadById(Admission),
      resolveId: (admission) => admission.id,
      scope: ({ before, after }) => this.scope(residentId, before, after),
      write: (manager) => {
        const repo = manager.getRepository(Admission);
        return repo.save(
          repo.create({
            residentId,
            houseId: dto.houseId ?? null,
            ministryId: null,
            entryDate: dto.entryDate as unknown as Date,
            exitDate: dto.exitDate as unknown as Date,
            status: dto.status,
          }),
        );
      },
    });
    return this.reload(saved.id);
  }

  async updateAdmission(
    residentId: string,
    admissionId: string,
    dto: UpdateAdmissionDto,
  ): Promise<Admission> {
    const resident = await this.residentService.findOne(residentId);
    const admissions = await this.residentService.findAdmissions(residentId);
    const target = admissions.find((admission) => admission.id === admissionId);
    if (!target) throw new NotFoundException(`Acolhimento ${admissionId} não encontrado`);

    const isCurrent = admissions[0].id === target.id;
    if (isCurrent) return this.updateCurrent(resident, target, admissions, dto);
    return this.updateClosed(resident, target, admissions, dto);
  }

  // Decisão 5: no atual só a entrada; espelha `resident.entry_date` na mesma
  // transação. O carnê NÃO é recalculado aqui (fora de escopo, aviso na UI).
  private async updateCurrent(
    resident: Resident,
    target: Admission,
    admissions: Admission[],
    dto: UpdateAdmissionDto,
  ): Promise<Admission> {
    if (dto.houseId !== undefined || dto.exitDate !== undefined || dto.status !== undefined) {
      throw new BadRequestException(ADMISSION_HISTORY_MESSAGES.currentOnlyEntryDate);
    }
    if (dto.entryDate === undefined) return this.reload(target.id);

    const previous = toPeriod(target);
    assertAdmissionDates({ entryDate: dto.entryDate }, { previous });
    this.assertNoOverlap({ id: target.id, entryDate: isoDate(dto.entryDate), exitDate: previous.exitDate }, admissions);

    await this.trackAdmission(resident.id, target.id, async (manager) => {
      await manager.getRepository(Admission).update(target.id, {
        entryDate: dto.entryDate as unknown as Date,
      });
      await this.audit.track({
        action: AuditAction.ADMISSION_UPDATE,
        targetType: AuditTargetType.RESIDENT,
        targetId: resident.id,
        fields: RESIDENT_AUDIT_FIELDS,
        load: loadById(Resident),
        lockTable: 'residents',
        manager,
        write: (m) =>
          m.getRepository(Resident).update(resident.id, { entryDate: dto.entryDate as unknown as Date }),
      });
    });
    return this.reload(target.id);
  }

  // Decisão 6: passagem encerrada — casa, datas e status de saída editáveis.
  // Só julga o que veio no payload (mesma linha da story 203, decisão 4).
  private async updateClosed(
    resident: Resident,
    target: Admission,
    admissions: Admission[],
    dto: UpdateAdmissionDto,
  ): Promise<Admission> {
    if (dto.status !== undefined) this.assertExitStatus(dto.status);
    if (dto.houseId !== undefined || dto.status !== undefined) {
      const houseId = dto.houseId !== undefined ? dto.houseId : target.houseId;
      await this.assertHouse(houseId, dto.status ?? (target.status as ResidentStatus), dto.houseId !== undefined);
    }

    const previous = toPeriod(target);
    assertAdmissionDates({ entryDate: dto.entryDate, exitDate: dto.exitDate }, { previous });
    if (dto.entryDate !== undefined || dto.exitDate !== undefined) {
      const period = {
        id: target.id,
        entryDate: dto.entryDate !== undefined ? isoDate(dto.entryDate) : previous.entryDate,
        exitDate: dto.exitDate !== undefined ? isoDate(dto.exitDate) : previous.exitDate,
      };
      if (dto.entryDate !== undefined) this.assertBeforeCurrent(period.entryDate, admissions[0], resident);
      this.assertNoOverlap(period, admissions);
    }

    const update: Partial<Admission> = {};
    if (dto.houseId !== undefined) update.houseId = dto.houseId;
    if (dto.entryDate !== undefined) update.entryDate = dto.entryDate as unknown as Date;
    if (dto.exitDate !== undefined) update.exitDate = dto.exitDate as unknown as Date;
    if (dto.status !== undefined) update.status = dto.status;
    if (Object.keys(update).length > 0) {
      await this.trackAdmission(resident.id, target.id, (manager) =>
        manager.getRepository(Admission).update(target.id, update),
      );
    }
    return this.reload(target.id);
  }

  private trackAdmission<R>(
    residentId: string,
    admissionId: string,
    write: (manager: EntityManager) => Promise<R>,
  ): Promise<R> {
    return this.audit.track<R>({
      action: AuditAction.ADMISSION_UPDATE,
      targetType: AuditTargetType.ADMISSION,
      targetId: admissionId,
      fields: ADMISSION_AUDIT_FIELDS,
      load: loadById(Admission),
      lockTable: 'admissions',
      scope: ({ before, after }) => this.scope(residentId, before, after),
      write,
    });
  }

  private scope(
    residentId: string,
    before: Parameters<typeof defaultScope>[0],
    after: Parameters<typeof defaultScope>[1],
  ) {
    return { ...defaultScope(before, after), parentType: AuditTargetType.RESIDENT, parentId: residentId };
  }

  private assertExitStatus(status: ResidentStatus): void {
    if (!ADMISSION_EXIT_STATUSES.includes(status)) {
      throw new BadRequestException(ADMISSION_HISTORY_MESSAGES.exitStatusRequired);
    }
  }

  /**
   * Casa nula só em passagem `ARCHIVED` (mesma regra do filho). `checkExists`
   * distingue a casa enviada (precisa existir) da gravada (não revalida).
   */
  private async assertHouse(
    houseId: string | null,
    status: ResidentStatus,
    checkExists = true,
  ): Promise<void> {
    if (!houseId) {
      if (status !== ResidentStatus.ARCHIVED) {
        throw new BadRequestException(ADMISSION_HISTORY_MESSAGES.houseRequired);
      }
      return;
    }
    if (!checkExists) return;
    const exists = await this.houseRepository.exists({ where: { id: houseId } });
    if (!exists) throw new BadRequestException('Casa não encontrada.');
  }

  /**
   * Passagem antiga tem de começar antes do acolhimento atual: se começasse
   * depois, viraria o "atual" (maior entrada) e a ficha passaria a espelhar
   * uma passagem encerrada. Sem nenhuma admissão, vale a entrada da ficha.
   */
  private assertBeforeCurrent(
    entryDate: string | null,
    current: Admission | undefined,
    resident: Resident,
  ): void {
    const currentEntry = isoDate(current ? current.entryDate : resident.entryDate);
    if (!entryDate || !currentEntry) return;
    if (entryDate >= currentEntry) {
      throw new BadRequestException(ADMISSION_HISTORY_MESSAGES.afterCurrent(currentEntry));
    }
  }

  private assertNoOverlap(
    period: { id?: string; entryDate: string | null; exitDate: string | null },
    admissions: Admission[],
  ): void {
    const overlap = findAdmissionOverlap(period, admissions.map(toPeriod));
    if (overlap) {
      throw new BadRequestException(
        ADMISSION_HISTORY_MESSAGES.overlap(overlap.entryDate, overlap.exitDate),
      );
    }
  }

  private async reload(id: string): Promise<Admission> {
    return this.admissionRepository.findOneOrFail({ where: { id }, relations: { house: true } });
  }
}
