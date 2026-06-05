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

  @Cron('0 8 * * *', {
    name: 'receivable-overdue',
    timeZone: 'America/Sao_Paulo',
  })
  async runOverdueReceivablesCheck(): Promise<{ created: number; skipped: number }> {
    this.logger.log('Starting overdue receivables notification check');

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    // Dedupe window: start of today (so a re-run on the same day does not duplicate).
    const windowStart = new Date(`${todayStr}T00:00:00.000Z`);

    const overdue = await this.receivableRepo.find({
      where: {
        status: ReceivableStatus.PENDING,
        dueDate: LessThan(todayStr as unknown as Date),
      },
      relations: ['resident'],
    });

    let created = 0;
    let skipped = 0;

    for (const receivable of overdue) {
      const already = await this.notifications.existsForEntitySince(
        NotificationType.RECEIVABLE_OVERDUE,
        receivable.id,
        windowStart,
      );
      if (already) {
        skipped += 1;
        continue;
      }

      const residentName = receivable.resident?.name ?? 'Acolhido';
      const dueStr = String(receivable.dueDate).slice(0, 10);

      try {
        await this.notifications.create({
          type: NotificationType.RECEIVABLE_OVERDUE,
          title: 'Parcela vencida',
          body: `A parcela de ${residentName} venceu em ${dueStr}.`,
          link: `/residents/${receivable.residentId}`,
          recipientRole: Role.ADMIN,
          metadata: {
            entityId: receivable.id,
            residentId: receivable.residentId,
            dueDate: dueStr,
          },
        });
        created += 1;
      } catch (error) {
        this.logger.error(
          `Failed to create overdue notification for receivable ${receivable.id}`,
          error instanceof Error ? error.stack : error,
        );
      }
    }

    this.logger.log(
      `Finished overdue receivables check: ${created} created, ${skipped} skipped`,
    );
    return { created, skipped };
  }
}
