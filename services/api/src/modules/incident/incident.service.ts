import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationType, Role } from '@fonte/types';
import { Incident } from './incident.entity';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class IncidentService {
  private readonly logger = new Logger(IncidentService.name);

  constructor(
    @InjectRepository(Incident)
    private repo: Repository<Incident>,
    private readonly notifications: NotificationService,
  ) {}

  findAll(houseId?: string, residentId?: string): Promise<Incident[]> {
    const where: Record<string, string> = {};
    if (houseId) where.houseId = houseId;
    if (residentId) where.residentId = residentId;
    return this.repo.find({
      where,
      relations: ['responsible', 'resident'],
      order: { date: 'DESC', createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Incident> {
    const incident = await this.repo.findOne({
      where: { id },
      relations: ['responsible', 'resident'],
    });
    if (!incident) throw new NotFoundException(`Incident ${id} not found`);
    return incident;
  }

  async create(dto: CreateIncidentDto): Promise<Incident> {
    const incident = await this.repo.save(this.repo.create(dto));
    await this.notifyCreated(incident);
    return incident;
  }

  // Best-effort: a failure here must never break the incident registration.
  private async notifyCreated(incident: Incident): Promise<void> {
    try {
      const body = incident.description?.slice(0, 140) ?? null;
      const metadata = { entityId: incident.id, residentId: incident.residentId };
      // ADMIN (consumed in adm) — central gestão, all houses.
      await this.notifications.create({
        type: NotificationType.INCIDENT_CREATED,
        title: 'Nova ocorrência registrada',
        body,
        link: `/houses/${incident.houseId}`,
        recipientRole: Role.ADMIN,
        metadata,
      });
      // House scope (consumed in ops by COORDINATOR/SERVANT of that house).
      await this.notifications.create({
        type: NotificationType.INCIDENT_CREATED,
        title: 'Nova ocorrência registrada',
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
