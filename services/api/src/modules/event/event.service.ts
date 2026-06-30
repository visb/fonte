import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event as EventDto, EventAudience } from '@fonte/types';
import { Event } from './event.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventFilterDto, ListEventsDto } from './dto/list-events.dto';
import { StorageService } from '../storage/storage.service';
import { normalizeRegistrationFields } from './registration-fields.util';

@Injectable()
export class EventService {
  constructor(
    @InjectRepository(Event)
    private repo: Repository<Event>,
    private storageService: StorageService,
  ) {}

  private toDate(value?: string | null): Date | null {
    return value != null ? new Date(value) : null;
  }

  /**
   * Coerência das datas (regra de negócio no service, 400 se violar).
   * A coerência da janela de inscrição só é exigida quando a inscrição está
   * habilitada (story 67); evento só-divulgação ignora a janela.
   */
  private validateDates(
    startAt: Date,
    endAt: Date | null,
    opensAt: Date | null,
    closesAt: Date | null,
    registrationEnabled: boolean,
  ): void {
    if (endAt && endAt < startAt) {
      throw new BadRequestException('endAt deve ser maior ou igual a startAt');
    }
    if (registrationEnabled && opensAt && closesAt && closesAt < opensAt) {
      throw new BadRequestException(
        'registrationClosesAt deve ser maior ou igual a registrationOpensAt',
      );
    }
  }

  /**
   * Cobrança coerente (story 69): inscrição paga exige preço > 0. Validado no
   * service (regra de negócio), não no controller.
   */
  private validatePayment(paymentEnabled: boolean, priceCents: number | null): void {
    if (paymentEnabled && (priceCents == null || priceCents <= 0)) {
      throw new BadRequestException(
        'priceCents deve ser maior que zero quando paymentEnabled = true',
      );
    }
  }

  /**
   * Coerência de audiência (story 94): evento INTERNAL é só divulgação para os
   * servos — nunca aceita inscrição nem cobrança. Se o cliente tentar combinar
   * INTERNAL com inscrição/pagamento ligados, é incoerente → 400. Caso contrário
   * (defaults/omitidos), força tudo desligado.
   */
  private rejectIncoherentInternal(
    audience: EventAudience,
    registrationEnabled: boolean | undefined,
    paymentEnabled: boolean | undefined,
  ): void {
    if (
      audience === EventAudience.INTERNAL &&
      (registrationEnabled === true || paymentEnabled === true)
    ) {
      throw new BadRequestException(
        'Evento interno não aceita inscrição nem cobrança',
      );
    }
  }

  async create(dto: CreateEventDto): Promise<EventDto> {
    const startAt = new Date(dto.startAt);
    const endAt = this.toDate(dto.endAt);
    const audience = dto.audience ?? EventAudience.PUBLIC;
    // Evento interno (story 94): só divulgação. Combinação com inscrição/paga é
    // incoerente → 400; senão tudo de inscrição/cobrança nasce desligado.
    this.rejectIncoherentInternal(audience, dto.registrationEnabled, dto.paymentEnabled);
    const internal = audience === EventAudience.INTERNAL;
    const opensAt = internal ? null : this.toDate(dto.registrationOpensAt);
    const closesAt = internal ? null : this.toDate(dto.registrationClosesAt);
    const registrationEnabled = internal ? false : (dto.registrationEnabled ?? false);
    this.validateDates(startAt, endAt, opensAt, closesAt, registrationEnabled);
    const paymentEnabled = internal ? false : (dto.paymentEnabled ?? false);
    const priceCents = paymentEnabled ? (dto.priceCents ?? null) : null;
    this.validatePayment(paymentEnabled, priceCents);

    const event = this.repo.create({
      title: dto.title,
      description: dto.description,
      startAt,
      endAt,
      location: dto.location ?? null,
      audience,
      capacity: internal ? null : (dto.capacity ?? null),
      registrationEnabled,
      paymentEnabled,
      priceCents,
      registrationFields: internal
        ? []
        : normalizeRegistrationFields(dto.registrationFields),
      registrationOpensAt: opensAt,
      registrationClosesAt: closesAt,
      bannerKey: null,
    });
    const saved = await this.repo.save(event);
    return this.toView(saved);
  }

  /**
   * Eventos internos (story 94): só audience=INTERNAL, futuros, ordenados por
   * data. Leitura para todos os papéis de Staff (adm.fonte e ops.fonte).
   */
  async listInternal(): Promise<EventDto[]> {
    const items = await this.repo
      .createQueryBuilder('e')
      .where('e.audience = :audience', { audience: EventAudience.INTERNAL })
      .andWhere('e.start_at >= :now', { now: new Date() })
      .orderBy('e.start_at', 'ASC')
      .getMany();
    return items.map((e) => this.toView(e));
  }

  async findAll(filters: ListEventsDto): Promise<EventDto[]> {
    const qb = this.repo.createQueryBuilder('e').orderBy('e.start_at', 'ASC');

    if (filters.filter === EventFilterDto.UPCOMING) {
      qb.andWhere('e.start_at >= :now', { now: new Date() });
    } else if (filters.filter === EventFilterDto.PAST) {
      qb.andWhere('e.start_at < :now', { now: new Date() });
    }

    if (filters.limit != null) qb.take(filters.limit);
    if (filters.offset != null) qb.skip(filters.offset);

    const items = await qb.getMany();
    return items.map((e) => this.toView(e));
  }

  async findOne(id: string): Promise<EventDto> {
    const event = await this.repo.findOne({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');
    return this.toView(event);
  }

  async update(id: string, dto: UpdateEventDto): Promise<EventDto> {
    const event = await this.repo.findOne({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');

    if (dto.title !== undefined) event.title = dto.title;
    if (dto.description !== undefined) event.description = dto.description;
    if (dto.startAt !== undefined) event.startAt = new Date(dto.startAt);
    if (dto.endAt !== undefined) event.endAt = this.toDate(dto.endAt);
    if (dto.location !== undefined) event.location = dto.location ?? null;
    if (dto.audience !== undefined) event.audience = dto.audience;
    if (dto.capacity !== undefined) event.capacity = dto.capacity ?? null;
    if (dto.registrationEnabled !== undefined)
      event.registrationEnabled = dto.registrationEnabled;
    if (dto.paymentEnabled !== undefined) event.paymentEnabled = dto.paymentEnabled;
    if (dto.priceCents !== undefined) event.priceCents = dto.priceCents ?? null;
    if (dto.registrationFields !== undefined)
      event.registrationFields = normalizeRegistrationFields(dto.registrationFields);
    if (dto.registrationOpensAt !== undefined)
      event.registrationOpensAt = this.toDate(dto.registrationOpensAt);
    if (dto.registrationClosesAt !== undefined)
      event.registrationClosesAt = this.toDate(dto.registrationClosesAt);

    // Evento interno (story 94): se o cliente tentar, no mesmo request, ligar
    // inscrição/cobrança junto de INTERNAL → 400 (combinação incoerente). Flags
    // herdadas de quando era público são apenas forçadas off, sem erro.
    this.rejectIncoherentInternal(
      event.audience,
      dto.registrationEnabled,
      dto.paymentEnabled,
    );
    if (event.audience === EventAudience.INTERNAL) {
      event.registrationEnabled = false;
      event.paymentEnabled = false;
      event.capacity = null;
      event.registrationFields = [];
      event.registrationOpensAt = null;
      event.registrationClosesAt = null;
    }
    // Inscrição grátis nunca carrega preço.
    if (!event.paymentEnabled) event.priceCents = null;

    this.validateDates(
      event.startAt,
      event.endAt,
      event.registrationOpensAt,
      event.registrationClosesAt,
      event.registrationEnabled,
    );
    this.validatePayment(event.paymentEnabled, event.priceCents);

    const saved = await this.repo.save(event);
    return this.toView(saved);
  }

  async remove(id: string): Promise<void> {
    const event = await this.repo.findOne({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');
    if (event.bannerKey) await this.storageService.delete(event.bannerKey);
    await this.repo.softRemove(event);
  }

  /** Anexa (ou substitui) o banner do evento. */
  async uploadBanner(id: string, file: Express.Multer.File): Promise<EventDto> {
    const event = await this.repo.findOne({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');

    if (event.bannerKey) await this.storageService.delete(event.bannerKey);

    const originalName = this.storageService.decodeOriginalName(file.originalname);
    const filename = this.storageService.uniqueFilename(originalName, 'banner_');
    event.bannerKey = await this.storageService.upload(
      'events',
      filename,
      file.buffer,
      file.mimetype,
    );

    const saved = await this.repo.save(event);
    return this.toView(saved);
  }

  private toView(e: Event): EventDto {
    return {
      id: e.id,
      title: e.title,
      description: e.description,
      startAt: e.startAt.toISOString(),
      endAt: e.endAt ? e.endAt.toISOString() : null,
      location: e.location ?? null,
      audience: e.audience,
      capacity: e.capacity ?? null,
      registrationEnabled: e.registrationEnabled,
      paymentEnabled: e.paymentEnabled,
      priceCents: e.priceCents ?? null,
      registrationFields: e.registrationFields ?? [],
      // O StorageUrlInterceptor (global) assina esta string se for uma URL S3.
      bannerUrl: e.bannerKey ?? null,
      registrationOpensAt: e.registrationOpensAt
        ? e.registrationOpensAt.toISOString()
        : null,
      registrationClosesAt: e.registrationClosesAt
        ? e.registrationClosesAt.toISOString()
        : null,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    };
  }
}
