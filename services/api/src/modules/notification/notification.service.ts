import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Brackets, Repository } from 'typeorm';
import { Notification as NotificationDto, NotificationType, Role } from '@fonte/types';
import { Notification } from './notification.entity';
import { NotificationRead } from './notification-read.entity';
import { Staff } from '../staff/staff.entity';
import {
  NOTIFICATION_CREATED_EVENT,
  NotificationCreatedEvent,
} from './notification.events';

export interface CreateNotificationInput {
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
  metadata?: Record<string, unknown> | null;
  recipientId?: string | null;
  recipientRole?: Role | null;
  houseId?: string | null;
}

/** Minimal authenticated identity the service needs to resolve targeting. */
export interface NotificationUser {
  userId: string;
  role: Role;
  // houseId is not on the JWT; resolved lazily from the Staff record.
  houseId?: string | null;
}

export interface ListNotificationsOptions {
  unreadOnly?: boolean;
  page?: number;
}

const PAGE_SIZE = 30;

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly repo: Repository<Notification>,
    @InjectRepository(NotificationRead)
    private readonly readsRepo: Repository<NotificationRead>,
    @InjectRepository(Staff)
    private readonly staffRepo: Repository<Staff>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Persists a notification and pushes it to the matching socket rooms. */
  async create(input: CreateNotificationInput): Promise<Notification> {
    const entity = this.repo.create({
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
      metadata: input.metadata ?? null,
      recipientId: input.recipientId ?? null,
      recipientRole: input.recipientRole ?? null,
      houseId: input.houseId ?? null,
    });
    const saved = await this.repo.save(entity);

    this.emitRealtime(saved);
    return saved;
  }

  /** Resolves the houseId of the authenticated staff user (null if none). */
  async resolveHouseId(user: NotificationUser): Promise<string | null> {
    if (user.houseId !== undefined) return user.houseId;
    const staff = await this.staffRepo.findOne({ where: { userId: user.userId } });
    return staff?.houseId ?? null;
  }

  async listForUser(
    user: NotificationUser,
    options: ListNotificationsOptions = {},
  ): Promise<NotificationDto[]> {
    const houseId = await this.resolveHouseId(user);
    const page = options.page && options.page > 0 ? options.page : 1;

    // Fetch the targeted page first, then resolve read-state with a second
    // query. (A single joined query with take/skip trips TypeORM's distinct
    // pagination path when selecting joined columns.)
    const qb = this.targetedQuery(user, houseId)
      .orderBy('n.created_at', 'DESC')
      .take(PAGE_SIZE)
      .skip((page - 1) * PAGE_SIZE);

    if (options.unreadOnly) {
      qb.andWhere(
        `NOT EXISTS (
          SELECT 1 FROM notification_reads nr
          WHERE nr.notification_id = n.id AND nr.user_id = :userId
        )`,
        { userId: user.userId },
      );
    }

    const notifications = await qb.getMany();
    const readIds = await this.readIdsFor(user.userId, notifications.map((n) => n.id));
    return notifications.map((n) => this.toDto(n, readIds.has(n.id)));
  }

  async unreadCount(user: NotificationUser): Promise<number> {
    const houseId = await this.resolveHouseId(user);
    return this.targetedQuery(user, houseId)
      .andWhere(
        `NOT EXISTS (
          SELECT 1 FROM notification_reads nr
          WHERE nr.notification_id = n.id AND nr.user_id = :userId
        )`,
        { userId: user.userId },
      )
      .getCount();
  }

  async markRead(id: string, user: NotificationUser): Promise<void> {
    const notification = await this.repo.findOne({ where: { id } });
    if (!notification) throw new NotFoundException(`Notification ${id} not found`);

    const existing = await this.readsRepo.findOne({
      where: { notificationId: id, userId: user.userId },
    });
    if (existing) return;

    await this.readsRepo.save(
      this.readsRepo.create({ notificationId: id, userId: user.userId }),
    );
  }

  async markAllRead(user: NotificationUser): Promise<void> {
    const houseId = await this.resolveHouseId(user);
    const unread = await this.targetedQuery(user, houseId)
      .andWhere(
        `NOT EXISTS (
          SELECT 1 FROM notification_reads nr
          WHERE nr.notification_id = n.id AND nr.user_id = :userId
        )`,
        { userId: user.userId },
      )
      .getMany();

    if (unread.length === 0) return;

    await this.readsRepo.save(
      unread.map((n) =>
        this.readsRepo.create({ notificationId: n.id, userId: user.userId }),
      ),
    );
  }

  /** Returns the subset of `notificationIds` already read by `userId`. */
  private async readIdsFor(
    userId: string,
    notificationIds: string[],
  ): Promise<Set<string>> {
    if (notificationIds.length === 0) return new Set();
    const reads = await this.readsRepo.find({
      where: notificationIds.map((notificationId) => ({ notificationId, userId })),
    });
    return new Set(reads.map((r) => r.notificationId));
  }

  /**
   * Idempotency helper for schedulers: true when a notification of `type`
   * already exists whose metadata `key` equals `value` within the dedupe
   * `windowStart`.
   */
  async existsByMetadataSince(
    type: NotificationType,
    key: string,
    value: string,
    windowStart: Date,
  ): Promise<boolean> {
    const count = await this.repo
      .createQueryBuilder('n')
      .where('n.type = :type', { type })
      .andWhere('n.created_at >= :windowStart', { windowStart })
      .andWhere(`n.metadata ->> :key = :value`, { key, value })
      .getCount();
    return count > 0;
  }

  /** Idempotency by referenced `entityId` in metadata. */
  async existsForEntitySince(
    type: NotificationType,
    entityId: string,
    windowStart: Date,
  ): Promise<boolean> {
    return this.existsByMetadataSince(type, 'entityId', entityId, windowStart);
  }

  /** Idempotency by referenced `residentId` in metadata. */
  async existsForResidentSince(
    type: NotificationType,
    residentId: string,
    windowStart: Date,
  ): Promise<boolean> {
    return this.existsByMetadataSince(type, 'residentId', residentId, windowStart);
  }

  /** Builds the targeting predicate shared by list/count/markAll. */
  private targetedQuery(user: NotificationUser, houseId: string | null) {
    return this.repo
      .createQueryBuilder('n')
      .where('n.deleted_at IS NULL')
      .andWhere(
        new Brackets((qb) => {
          qb.where('n.recipient_id = :userId', { userId: user.userId }).orWhere(
            new Brackets((bq) => {
              bq.where('n.recipient_id IS NULL')
                .andWhere(
                  new Brackets((rq) => {
                    rq.where('n.recipient_role IS NULL').orWhere(
                      'n.recipient_role = :role',
                      { role: user.role },
                    );
                  }),
                )
                .andWhere(
                  new Brackets((hq) => {
                    if (houseId) {
                      hq.where('n.house_id IS NULL').orWhere(
                        'n.house_id = :houseId',
                        { houseId },
                      );
                    } else {
                      hq.where('n.house_id IS NULL');
                    }
                  }),
                );
            }),
          );
        }),
      );
  }

  /** Emits the realtime event for the gateway to forward to socket rooms. */
  private emitRealtime(n: Notification): void {
    try {
      const rooms: string[] = [];
      if (n.recipientId) rooms.push(`user:${n.recipientId}`);
      if (n.recipientRole) rooms.push(`role:${n.recipientRole}`);
      if (n.houseId) rooms.push(`house:${n.houseId}`);

      const event: NotificationCreatedEvent = {
        rooms,
        payload: this.toDto(n, false),
      };
      this.eventEmitter.emit(NOTIFICATION_CREATED_EVENT, event);
    } catch (error) {
      this.logger.warn(
        `Failed to emit realtime notification ${n.id}: ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }

  private toDto(n: Notification, read: boolean): NotificationDto {
    return {
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      link: n.link,
      metadata: n.metadata,
      recipientId: n.recipientId,
      recipientRole: n.recipientRole,
      houseId: n.houseId,
      read,
      createdAt:
        n.createdAt instanceof Date
          ? n.createdAt.toISOString()
          : String(n.createdAt),
    };
  }
}
