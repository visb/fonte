import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { EventInviteResult, EventInviteSkipped } from '@fonte/types';
import {
  WHATSAPP_CLIENT,
  WhatsAppClient,
} from '../associate/whatsapp/whatsapp.types';
import { Event } from './event.entity';
import { Staff } from '../staff/staff.entity';

/**
 * Convite de servos via WhatsApp para um evento (story 95). Reusa o
 * `WhatsAppClient` (Meta Cloud API, template aprovado) dos associados.
 *
 * Env:
 *  - META_WA_TEMPLATE_NAME_EVENT_INVITE — template do convite (título/data/local
 *    no corpo + botão de URL com o link público de detalhe).
 *  - PORTAL_URL / APP_ASSOCIADOS_URL — base do link `<base>/eventos/<id>`.
 *
 * Best-effort por servo: sem número válido ou falha da Meta → entra em
 * `skipped` com o motivo; NUNCA aborta o lote nem lança para o controller
 * (exceto evento inexistente → 404).
 */
@Injectable()
export class EventInviteService {
  private readonly logger = new Logger(EventInviteService.name);

  constructor(
    @InjectRepository(Event)
    private readonly eventsRepo: Repository<Event>,
    @InjectRepository(Staff)
    private readonly staffRepo: Repository<Staff>,
    @Inject(WHATSAPP_CLIENT) private readonly whatsapp: WhatsAppClient,
    private readonly config: ConfigService,
  ) {}

  /** Base pública do portal (mesmo fallback do EventPaymentNotifierService). */
  private get portalUrl(): string {
    return (
      this.config.get<string>('PORTAL_URL') ??
      this.config.get<string>('APP_ASSOCIADOS_URL') ??
      ''
    ).replace(/\/$/, '');
  }

  /** Template Meta do convite de evento (precisa estar aprovado na Meta). */
  private get templateName(): string {
    return (
      this.config.get<string>('META_WA_TEMPLATE_NAME_EVENT_INVITE') ??
      'convite_evento'
    );
  }

  /** Link público de detalhe do evento — funciona por link direto (story 95). */
  buildEventLink(eventId: string): string {
    return `${this.portalUrl}/eventos/${eventId}`;
  }

  /**
   * Normaliza o whatsapp do Staff (persistido só com dígitos, story 97) para
   * E.164 brasileiro: 10-11 dígitos ganham o DDI 55; 12-13 dígitos já com 55
   * ganham o `+`. Qualquer outro formato é inválido → null (servo pulado).
   */
  private toE164(whatsapp: string | null): string | null {
    if (!whatsapp) return null;
    const digits = whatsapp.replace(/\D/g, '');
    if (/^\d{10,11}$/.test(digits)) return `+55${digits}`;
    if (/^55\d{10,11}$/.test(digits)) return `+${digits}`;
    return null;
  }

  /** Data/hora do evento em pt-BR (fuso de Brasília) para o corpo do template. */
  private formatStartAt(startAt: Date): string {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'America/Sao_Paulo',
    }).format(startAt);
  }

  /**
   * Dispara o convite para os servos selecionados. Devolve o resumo
   * `{ sent, skipped }` — falha individual não aborta os demais envios.
   */
  async inviteStaff(eventId: string, staffIds: string[]): Promise<EventInviteResult> {
    const event = await this.eventsRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');

    const uniqueIds = [...new Set(staffIds)];
    const staff = await this.staffRepo.find({ where: { id: In(uniqueIds) } });
    const staffById = new Map(staff.map((s) => [s.id, s]));

    const link = this.buildEventLink(event.id);
    const variables = [
      event.title,
      this.formatStartAt(event.startAt),
      event.location ?? 'a definir',
    ];

    const sent: string[] = [];
    const skipped: EventInviteSkipped[] = [];

    for (const staffId of uniqueIds) {
      const member = staffById.get(staffId);
      if (!member) {
        skipped.push({ staffId, reason: 'NOT_FOUND' });
        continue;
      }

      const toE164 = this.toE164(member.whatsapp);
      if (!toE164) {
        skipped.push({ staffId, reason: 'NO_WHATSAPP' });
        continue;
      }

      try {
        const result = await this.whatsapp.sendTemplate({
          toE164,
          templateName: this.templateName,
          variables,
          // O cliente usa `urlLink` (link completo) direto no botão de URL.
          urlButtonParam: event.id,
          urlLink: link,
        });
        if (result.sent) {
          sent.push(staffId);
        } else {
          skipped.push({ staffId, reason: 'SEND_FAILED' });
        }
      } catch (error) {
        // Defesa extra: o cliente já é best-effort, mas nada pode abortar o lote.
        this.logger.error(
          `Falha inesperada ao convidar staff ${staffId} para o evento ${event.id}`,
          error instanceof Error ? error.stack : error,
        );
        skipped.push({ staffId, reason: 'SEND_FAILED' });
      }
    }

    return { sent, skipped };
  }
}
