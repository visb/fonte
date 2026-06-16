import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, MoreThanOrEqual, Repository } from 'typeorm';
import { AssociateStatus, ChargeStatus } from '@fonte/types';
import { Associate } from './associate.entity';
import { AssociateCharge } from './associate-charge.entity';
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

  /**
   * A partir de quantos lembretes consecutivos o template ganha o link de
   * autocancelamento (story 45). `reminderStreak >= 2` significa que já houve 2
   * envios no streak atual e este é o 3º+ — só então oferecemos a saída.
   */
  private static readonly CANCEL_LINK_STREAK_THRESHOLD = 2;

  constructor(
    @InjectRepository(Associate)
    private readonly associateRepo: Repository<Associate>,
    @InjectRepository(AssociateChargeNotification)
    private readonly notificationRepo: Repository<AssociateChargeNotification>,
    @InjectRepository(AssociateCharge)
    private readonly chargeRepo: Repository<AssociateCharge>,
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

      const result = await this.whatsapp.sendTemplate(
        await this.buildSendInput(associate),
      );

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

  /**
   * Conta o "streak" de lembretes consecutivos do associado (story 45) = nº de
   * registros em `associate_charge_notifications` com `sent_at` APÓS o `paid_at`
   * da cobrança `PAID` mais recente (ou desde sempre, se nunca pagou). Pagar e
   * voltar a atrasar zera o streak.
   */
  private async reminderStreak(associateId: string): Promise<number> {
    const lastPaid = await this.chargeRepo.findOne({
      where: {
        associateId,
        status: ChargeStatus.PAID,
      },
      order: { paidAt: 'DESC' },
    });

    const sentSince =
      lastPaid?.paidAt != null
        ? { sentAt: MoreThanOrEqual(lastPaid.paidAt) }
        : {};

    return this.notificationRepo.count({
      where: { associateId, ...sentSince },
    });
  }

  /**
   * Monta o payload do template de cobrança. A partir do 3º lembrete consecutivo
   * (`reminderStreak >= 2`) usa o template cancelável (com o 2º botão de URL) e
   * inclui `cancelUrlButtonParam`; caso contrário, o template padrão.
   */
  private async buildSendInput(associate: Associate) {
    const streak = await this.reminderStreak(associate.id);
    const cancelable =
      streak >= AssociateChargeScheduler.CANCEL_LINK_STREAK_THRESHOLD;

    const templateName = cancelable
      ? this.config.get<string>('META_WA_TEMPLATE_NAME_CANCELABLE') ??
        'cobranca_associado_cancelavel'
      : this.config.get<string>('META_WA_TEMPLATE_NAME') ?? 'cobranca_associado';

    return {
      toE164: associate.whatsapp,
      templateName,
      variables: [associate.name],
      urlButtonParam: associate.paymentToken,
      ...(cancelable ? { cancelUrlButtonParam: associate.paymentToken } : {}),
    };
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

    const result = await this.whatsapp.sendTemplate(
      await this.buildSendInput(associate),
    );
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
