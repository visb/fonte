import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import {
  EventPublic,
  EventRegistration as EventRegistrationDto,
  EventRegistrationResult,
} from '@fonte/types';
import { Event } from './event.entity';
import { EventRegistration } from './event-registration.entity';
import { RegisterToEventDto } from './dto/register-to-event.dto';

@Injectable()
export class EventRegistrationService {
  constructor(
    @InjectRepository(Event)
    private eventsRepo: Repository<Event>,
    @InjectRepository(EventRegistration)
    private registrationsRepo: Repository<EventRegistration>,
  ) {}

  private async activeCount(eventId: string): Promise<number> {
    return this.registrationsRepo.count({ where: { eventId } });
  }

  /** Vagas restantes: null quando capacidade ilimitada; nunca negativo. */
  private spotsLeft(capacity: number | null, used: number): number | null {
    if (capacity == null) return null;
    return Math.max(0, capacity - used);
  }

  /** A inscrição está aberta agora? (janela respeitada, não passado, não esgotado.) */
  private isRegistrationOpen(
    event: Event,
    now: Date,
    spotsLeft: number | null,
  ): boolean {
    if (event.startAt < now) return false;
    if (event.registrationOpensAt && now < event.registrationOpensAt) return false;
    if (event.registrationClosesAt && now > event.registrationClosesAt) return false;
    if (spotsLeft != null && spotsLeft <= 0) return false;
    return true;
  }

  private async toPublicView(event: Event, now = new Date()): Promise<EventPublic> {
    const used = await this.activeCount(event.id);
    const spotsLeft = this.spotsLeft(event.capacity, used);
    return {
      id: event.id,
      title: event.title,
      description: event.description,
      startAt: event.startAt.toISOString(),
      endAt: event.endAt ? event.endAt.toISOString() : null,
      location: event.location ?? null,
      // Assinado pelo StorageUrlInterceptor global se for URL S3.
      bannerUrl: event.bannerKey ?? null,
      capacity: event.capacity ?? null,
      spotsLeft,
      registrationOpensAt: event.registrationOpensAt
        ? event.registrationOpensAt.toISOString()
        : null,
      registrationClosesAt: event.registrationClosesAt
        ? event.registrationClosesAt.toISOString()
        : null,
      registrationOpen: this.isRegistrationOpen(event, now, spotsLeft),
    };
  }

  /** Lista pública: apenas eventos futuros (start_at >= agora), ordenados por data. */
  async listPublic(): Promise<EventPublic[]> {
    const now = new Date();
    const events = await this.eventsRepo
      .createQueryBuilder('e')
      .where('e.start_at >= :now', { now })
      .orderBy('e.start_at', 'ASC')
      .getMany();
    return Promise.all(events.map((e) => this.toPublicView(e, now)));
  }

  async getPublicView(id: string): Promise<EventPublic> {
    const event = await this.eventsRepo.findOne({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');
    return this.toPublicView(event);
  }

  /** Inscreve no evento aplicando janela e lotação. */
  async register(id: string, dto: RegisterToEventDto): Promise<EventRegistrationResult> {
    const event = await this.eventsRepo.findOne({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');

    const now = new Date();
    if (event.startAt < now) {
      throw new BadRequestException('O evento já ocorreu');
    }
    if (event.registrationOpensAt && now < event.registrationOpensAt) {
      throw new BadRequestException('As inscrições ainda não abriram');
    }
    if (event.registrationClosesAt && now > event.registrationClosesAt) {
      throw new BadRequestException('As inscrições estão encerradas');
    }
    if (event.capacity != null) {
      const used = await this.activeCount(id);
      if (used >= event.capacity) {
        throw new ConflictException('Vagas esgotadas');
      }
    }

    const registration = this.registrationsRepo.create({
      eventId: id,
      name: dto.name,
      contact: dto.contact,
      email: dto.email ?? null,
    });
    const saved = await this.registrationsRepo.save(registration);
    return { id: saved.id, eventId: id, name: saved.name };
  }

  /** Inscritos de um evento (uso administrativo). */
  async listRegistrations(eventId: string): Promise<EventRegistrationDto[]> {
    const event = await this.eventsRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');

    const items = await this.registrationsRepo.find({
      where: { eventId, deletedAt: IsNull() },
      order: { createdAt: 'ASC' },
    });
    return items.map((r) => ({
      id: r.id,
      eventId: r.eventId,
      name: r.name,
      contact: r.contact,
      email: r.email ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}
