import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, SelectQueryBuilder } from 'typeorm';
import { IncidentType, NotificationType, Role } from '@fonte/types';
import { Incident } from './incident.entity';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { NotificationService } from '../notification/notification.service';
import { Resident } from '../resident/resident.entity';

/**
 * Filhos envolvidos de um create: `residentIds ∪ [residentId]` (story 227). O
 * `residentId` legado vem de APKs antigos e da fila offline; mandar os dois
 * resulta na união, sem duplicata, na ordem em que chegaram.
 */
export function normalizeResidentIds(dto: Pick<CreateIncidentDto, 'residentIds' | 'residentId'>): string[] {
  const ids = [...(dto.residentIds ?? []), ...(dto.residentId ? [dto.residentId] : [])];
  return [...new Set(ids)];
}

@Injectable()
export class IncidentService {
  private readonly logger = new Logger(IncidentService.name);

  constructor(
    @InjectRepository(Incident)
    private repo: Repository<Incident>,
    @InjectRepository(Resident)
    private residentsRepo: Repository<Resident>,
    private readonly notifications: NotificationService,
  ) {}

  /**
   * Filtro por filho via junção: o `innerJoin` só restringe as ocorrências; a
   * lista `residents` devolvida traz TODOS os envolvidos, não só o filtrado.
   */
  findAll(houseId?: string, residentId?: string): Promise<Incident[]> {
    const qb = this.baseQuery();
    if (houseId) qb.andWhere('incident.houseId = :houseId', { houseId });
    if (residentId) {
      qb.innerJoin('incident.residents', 'filterResident', 'filterResident.id = :residentId', {
        residentId,
      });
    }
    return qb.orderBy('incident.date', 'DESC').addOrderBy('incident.createdAt', 'DESC').getMany();
  }

  async findOne(id: string): Promise<Incident> {
    const incident = await this.baseQuery().where('incident.id = :id', { id }).getOne();
    if (!incident) throw new NotFoundException(`Incident ${id} not found`);
    return incident;
  }

  async create(dto: CreateIncidentDto): Promise<Incident> {
    const residents = await this.resolveResidents(normalizeResidentIds(dto), dto.houseId);
    const { residentIds: _ids, residentId: _legacy, severity: _severity, type, ...data } = dto;
    // Story 229: `type` só falta no payload legado (com `severity`) — toda
    // ocorrência antiga era um problema, então vira NEGATIVE. `severity` nunca persiste.
    const incident = await this.repo.save(
      this.repo.create({ ...data, type: type ?? IncidentType.NEGATIVE, residents }),
    );
    incident.residents = residents.map(({ id, name }) => ({ id, name }) as Resident);
    await this.notifyCreated(incident);
    return incident;
  }

  // Responsável completo (como antes); dos filhos só id + nome — a ficha do
  // filho tem dados sensíveis que não pertencem à resposta da ocorrência.
  private baseQuery(): SelectQueryBuilder<Incident> {
    return this.repo
      .createQueryBuilder('incident')
      .leftJoinAndSelect('incident.responsible', 'responsible')
      .leftJoin('incident.residents', 'resident')
      .addSelect(['resident.id', 'resident.name']);
  }

  private async resolveResidents(ids: string[], houseId: string): Promise<Resident[]> {
    if (!ids.length) return [];
    const found = await this.residentsRepo.find({
      where: { id: In(ids) },
      select: { id: true, name: true, houseId: true },
    });
    if (found.length !== ids.length) {
      throw new BadRequestException('Filho envolvido não encontrado.');
    }
    if (found.some((resident) => resident.houseId !== houseId)) {
      throw new BadRequestException('Todos os filhos envolvidos devem ser da casa da ocorrência.');
    }
    const byId = new Map(found.map((resident) => [resident.id, resident]));
    return ids.map((id) => byId.get(id)!);
  }

  // Best-effort: a failure here must never break the incident registration.
  private async notifyCreated(incident: Incident): Promise<void> {
    try {
      const body = incident.description?.slice(0, 140) ?? null;
      const title =
        incident.type === IncidentType.POSITIVE ? 'Nova ocorrência positiva' : 'Nova ocorrência negativa';
      const metadata = {
        entityId: incident.id,
        residentIds: incident.residents.map((resident) => resident.id),
      };
      // ADMIN (consumed in adm) — central gestão, all houses.
      await this.notifications.create({
        type: NotificationType.INCIDENT_CREATED,
        title,
        body,
        link: `/houses/${incident.houseId}`,
        recipientRole: Role.ADMIN,
        metadata,
      });
      // House scope (consumed in ops by COORDINATOR/SERVANT of that house).
      await this.notifications.create({
        type: NotificationType.INCIDENT_CREATED,
        title,
        body,
        link: `/incidents`,
        houseId: incident.houseId,
        metadata,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to emit INCIDENT_CREATED notification for ${incident.id}: ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }
}
