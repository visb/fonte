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
  RegistrationAnswerValue,
  RegistrationFileResult,
} from '@fonte/types';
import { Event } from './event.entity';
import { EventRegistration } from './event-registration.entity';
import { RegisterToEventDto } from './dto/register-to-event.dto';
import { validateAndPickAnswers } from './registration-fields.util';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class EventRegistrationService {
  constructor(
    @InjectRepository(Event)
    private eventsRepo: Repository<Event>,
    @InjectRepository(EventRegistration)
    private registrationsRepo: Repository<EventRegistration>,
    private storageService: StorageService,
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
      registrationFields: event.registrationFields ?? [],
      registrationOpensAt: event.registrationOpensAt
        ? event.registrationOpensAt.toISOString()
        : null,
      registrationClosesAt: event.registrationClosesAt
        ? event.registrationClosesAt.toISOString()
        : null,
      registrationOpen: this.isRegistrationOpen(event, now, spotsLeft),
    };
  }

  /**
   * Lista pública: apenas eventos futuros (start_at >= agora) COM inscrição
   * habilitada (story 67), ordenados por data. Eventos só-divulgação não vazam.
   */
  async listPublic(): Promise<EventPublic[]> {
    const now = new Date();
    const events = await this.eventsRepo
      .createQueryBuilder('e')
      .where('e.start_at >= :now', { now })
      .andWhere('e.registration_enabled = true')
      .orderBy('e.start_at', 'ASC')
      .getMany();
    return Promise.all(events.map((e) => this.toPublicView(e, now)));
  }

  async getPublicView(id: string): Promise<EventPublic> {
    const event = await this.eventsRepo.findOne({ where: { id } });
    // Evento com inscrição desligada não tem detalhe público (não vaza interno).
    if (!event || !event.registrationEnabled) {
      throw new NotFoundException('Event not found');
    }
    return this.toPublicView(event);
  }

  /** Inscreve no evento aplicando janela e lotação. */
  async register(id: string, dto: RegisterToEventDto): Promise<EventRegistrationResult> {
    const event = await this.eventsRepo.findOne({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');
    // Defesa em profundidade: inscrição desligada não aceita inscrito (story 67).
    if (!event.registrationEnabled) {
      throw new NotFoundException('Event not found');
    }

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

    // Valida e filtra as respostas custom (story 68) pela definição do evento.
    // Persiste só os fieldIds conhecidos (ignora chaves estranhas).
    const answers = validateAndPickAnswers(
      event.registrationFields ?? [],
      dto.answers,
    );

    const registration = this.registrationsRepo.create({
      eventId: id,
      name: dto.name,
      contact: dto.contact,
      email: dto.email ?? null,
      answers,
    });
    const saved = await this.registrationsRepo.save(registration);
    return { id: saved.id, eventId: id, name: saved.name };
  }

  /**
   * Upload público de arquivo de um campo `file` da inscrição (story 68).
   * O multipart não cabe no JSON do register; este endpoint grava no storage e
   * devolve a `fileKey`, que o register recebe em `answers[fieldId]`.
   */
  async uploadRegistrationFile(
    eventId: string,
    file: Express.Multer.File,
  ): Promise<RegistrationFileResult> {
    const event = await this.eventsRepo.findOne({ where: { id: eventId } });
    if (!event || !event.registrationEnabled) {
      throw new NotFoundException('Event not found');
    }
    const originalName = this.storageService.decodeOriginalName(file.originalname);
    const filename = this.storageService.uniqueFilename(originalName, 'reg_');
    const fileKey = await this.storageService.upload(
      'event-registrations',
      filename,
      file.buffer,
      file.mimetype,
    );
    return { fileKey };
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
      // Campos `file` guardam a storage key; se for URL S3, o
      // StorageUrlInterceptor (global) a assina ao serializar a resposta.
      answers: (r.answers ?? {}) as Record<string, RegistrationAnswerValue>,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}
