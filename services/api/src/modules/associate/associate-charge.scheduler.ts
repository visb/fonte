import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, MoreThanOrEqual, Repository } from 'typeorm';
import { AssociateStatus } from '@fonte/types';
import { Associate } from './associate.entity';
import {
  AssociateChargeNotification,
  AssociateNotificationType,
} from './associate-charge-notification.entity';
import { WHATSAPP_CLIENT, WhatsAppClient } from './whatsapp/whatsapp.types';

export interface AssociateChargeRunResult {
  sent: number;
  skipped: number;
}

/**
 * Job diário de cobrança de associados via WhatsApp (story 39).
 *
 * Gatilhos (apenas dois — a recorrência do cartão é gerida pelo gateway):
 *  1. ADESÃO     — associado PENDING cujo vencimento (due_day) é hoje ou já passou.
 *  2. REATIVAÇÃO — associado PAST_DUE (cobrança recorrente do cartão falhou em [[38]]).
 *
 * ACTIVE/CANCELED nunca recebem WhatsApp.
 *
 * Dedupe: no máximo 1 envio a cada 5 dias por associado (espelha
 * `existsForResidentSince` do notification module). Após enviar com sucesso,
 * grava log em `associate_charge_notifications`.
 *
 * Best-effort: falha de envio loga e não derruba o job (padrão do
 * `notification.scheduler`).
 */
@Injectable()
export class AssociateChargeScheduler {
  private readonly logger = new Logger(AssociateChargeScheduler.name);

  /** Teto de frequência de cobrança por associado (decisão travada do epic [[36]]). */
  private static readonly DEDUPE_WINDOW_DAYS = 5;

  constructor(
    @InjectRepository(Associate)
    private readonly associateRepo: Repository<Associate>,
    @InjectRepository(AssociateChargeNotification)
    private readonly notificationRepo: Repository<AssociateChargeNotification>,
    @Inject(WHATSAPP_CLIENT)
    private readonly whatsapp: WhatsAppClient,
    private readonly config: ConfigService,
  ) {}

  @Cron('0 9 * * *', {
    name: 'associate-charge',
    timeZone: 'America/Sao_Paulo',
  })
  async runDailyChargeCheck(): Promise<AssociateChargeRunResult> {
    this.logger.log('Starting associate WhatsApp charge check');

    const now = new Date();
    const windowStart = new Date(now);
    windowStart.setUTCDate(
      windowStart.getUTCDate() - AssociateChargeScheduler.DEDUPE_WINDOW_DAYS,
    );
    const todayDay = now.getUTCDate();

    const candidates = await this.associateRepo.find({
      where: {
        status: In([AssociateStatus.PENDING, AssociateStatus.PAST_DUE]),
        deletedAt: IsNull(),
      },
    });

    let sent = 0;
    let skipped = 0;

    for (const associate of candidates) {
      const type = this.triggerFor(associate, todayDay);
      if (!type) {
        // PENDING ainda não venceu (due_day no futuro neste mês).
        skipped += 1;
        continue;
      }

      const recentlyNotified = await this.notificationRepo.exists({
        where: {
          associateId: associate.id,
          sentAt: MoreThanOrEqual(windowStart),
        },
      });
      if (recentlyNotified) {
        skipped += 1;
        continue;
      }

      const result = await this.whatsapp.sendTemplate({
        toE164: associate.whatsapp,
        templateName:
          this.config.get<string>('META_WA_TEMPLATE_NAME') ?? 'cobranca_associado',
        variables: [associate.name],
        urlButtonParam: associate.paymentToken,
      });

      if (!result.sent) {
        // Best-effort: envio falhou (sem credencial/erro) — loga e não grava log
        // de dedupe, para reenviar na próxima rodada.
        this.logger.warn(
          `WhatsApp não enviado para associado ${associate.id} (${type}); seguindo.`,
        );
        skipped += 1;
        continue;
      }

      try {
        await this.notificationRepo.save(
          this.notificationRepo.create({
            associateId: associate.id,
            channel: 'WHATSAPP',
            type,
            sentAt: new Date(),
          }),
        );
        sent += 1;
      } catch (error) {
        this.logger.error(
          `Failed to log charge notification for associate ${associate.id}`,
          error instanceof Error ? error.stack : error,
        );
        skipped += 1;
      }
    }

    this.logger.log(
      `Finished associate charge check: ${sent} sent, ${skipped} skipped`,
    );
    return { sent, skipped };
  }

  /**
   * Define o gatilho de cobrança do associado, ou null se não deve cobrar agora.
   *  - PAST_DUE → REACTIVATION (sempre, independente do dia).
   *  - PENDING  → ADHESION apenas se o vencimento (due_day) é hoje ou já passou
   *    no mês corrente (clamp ao último dia do mês via comparação de dia).
   */
  private triggerFor(
    associate: Associate,
    todayDay: number,
  ): AssociateNotificationType | null {
    if (associate.status === AssociateStatus.PAST_DUE) return 'REACTIVATION';
    if (associate.status === AssociateStatus.PENDING) {
      return associate.dueDay <= todayDay ? 'ADHESION' : null;
    }
    return null;
  }

  /** Disparo manual de cobrança (endpoint ADMIN), respeitando o dedupe de 5 dias. */
  async chargeManually(associateId: string): Promise<{ sent: boolean; skipped: boolean }> {
    const associate = await this.associateRepo.findOne({
      where: { id: associateId, deletedAt: IsNull() },
    });
    if (!associate) {
      return { sent: false, skipped: true };
    }

    const type =
      associate.status === AssociateStatus.PAST_DUE
        ? ('REACTIVATION' as const)
        : associate.status === AssociateStatus.PENDING
          ? ('ADHESION' as const)
          : null;
    if (!type) {
      // ACTIVE/CANCELED não recebem cobrança manual.
      return { sent: false, skipped: true };
    }

    const windowStart = new Date();
    windowStart.setUTCDate(
      windowStart.getUTCDate() - AssociateChargeScheduler.DEDUPE_WINDOW_DAYS,
    );
    const recentlyNotified = await this.notificationRepo.exists({
      where: { associateId: associate.id, sentAt: MoreThanOrEqual(windowStart) },
    });
    if (recentlyNotified) {
      return { sent: false, skipped: true };
    }

    const result = await this.whatsapp.sendTemplate({
      toE164: associate.whatsapp,
      templateName:
        this.config.get<string>('META_WA_TEMPLATE_NAME') ?? 'cobranca_associado',
      variables: [associate.name],
      urlButtonParam: associate.paymentToken,
    });
    if (!result.sent) {
      return { sent: false, skipped: true };
    }

    await this.notificationRepo.save(
      this.notificationRepo.create({
        associateId: associate.id,
        channel: 'WHATSAPP',
        type,
        sentAt: new Date(),
      }),
    );
    return { sent: true, skipped: false };
  }
}
