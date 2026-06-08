import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { NotificationType, ReceivableStatus, Role } from '@fonte/types';
import { ResidentReceivable } from '../resident-receivable/resident-receivable.entity';
import { NotificationService } from './notification.service';

@Injectable()
export class NotificationScheduler {
  private readonly logger = new Logger(NotificationScheduler.name);

  constructor(
    @InjectRepository(ResidentReceivable)
    private readonly receivableRepo: Repository<ResidentReceivable>,
    private readonly notifications: NotificationService,
  ) {}

  // One overdue notification per resident, deduped over a rolling 7-day window,
  // so a family with several overdue installments gets a single weekly digest
  // instead of one notification per installment every day.
  private static readonly DEDUPE_WINDOW_DAYS = 7;

  @Cron('0 8 * * *', {
    name: 'receivable-overdue',
    timeZone: 'America/Sao_Paulo',
  })
  async runOverdueReceivablesCheck(): Promise<{ created: number; skipped: number }> {
    this.logger.log('Starting overdue receivables notification check');

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    // Dedupe window: last 7 days (so at most one notification per resident/week).
    const windowStart = new Date(today);
    windowStart.setUTCDate(windowStart.getUTCDate() - NotificationScheduler.DEDUPE_WINDOW_DAYS);

    const overdue = await this.receivableRepo.find({
      where: {
        status: ReceivableStatus.PENDING,
        dueDate: LessThan(todayStr as unknown as Date),
      },
      relations: ['resident'],
    });

    const byResident = this.groupByResident(overdue);

    let created = 0;
    let skipped = 0;

    for (const [residentId, items] of byResident) {
      const already = await this.notifications.existsForResidentSince(
        NotificationType.RECEIVABLE_OVERDUE,
        residentId,
        windowStart,
      );
      if (already) {
        skipped += 1;
        continue;
      }

      const residentName = items[0].resident?.name ?? 'Acolhido';
      const dueDates = items.map((i) => String(i.dueDate).slice(0, 10)).sort();
      const oldestDue = dueDates[0];
      const oldestDueBr = this.formatBrDate(oldestDue);
      const count = items.length;
      const body =
        count === 1
          ? `A parcela de ${residentName} venceu em ${oldestDueBr}.`
          : `${residentName} tem ${count} parcelas vencidas (a mais antiga em ${oldestDueBr}).`;

      try {
        await this.notifications.create({
          type: NotificationType.RECEIVABLE_OVERDUE,
          title: count === 1 ? 'Parcela vencida' : 'Parcelas vencidas',
          body,
          link: `/residents/${residentId}`,
          recipientRole: Role.ADMIN,
          metadata: {
            residentId,
            count,
            oldestDueDate: oldestDue,
          },
        });
        created += 1;
      } catch (error) {
        this.logger.error(
          `Failed to create overdue notification for resident ${residentId}`,
          error instanceof Error ? error.stack : error,
        );
      }
    }

    this.logger.log(
      `Finished overdue receivables check: ${created} created, ${skipped} skipped`,
    );
    return { created, skipped };
  }

  /** Converts an ISO date (yyyy-mm-dd) to Brazilian format (dd/mm/yyyy). */
  private formatBrDate(isoDate: string): string {
    const [year, month, day] = isoDate.split('-');
    return `${day}/${month}/${year}`;
  }

  private groupByResident(
    receivables: ResidentReceivable[],
  ): Map<string, ResidentReceivable[]> {
    const groups = new Map<string, ResidentReceivable[]>();
    for (const receivable of receivables) {
      const list = groups.get(receivable.residentId);
      if (list) list.push(receivable);
      else groups.set(receivable.residentId, [receivable]);
    }
    return groups;
  }
}
