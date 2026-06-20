import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ActivityEvent as ActivityEventDto,
  ActivityEventType,
} from '@fonte/types';
import { ActivityEvent } from './activity-event.entity';
import { ActivityUser } from './activity.service';

/**
 * Serviço da trilha de auditoria (story 66). Não depende do ActivityService para
 * evitar ciclo: a validação de visibilidade na listagem é feita pelo controller
 * via `ActivityService.loadVisibleOrFail`, que injeta este serviço. O registro de
 * eventos é chamado pelo próprio `activity.service` / `activity-comment.service`.
 *
 * `resolveActorRefs` é injetado pelo chamador (ActivityService) para resolver o
 * nome do ator sem acoplar este serviço ao repositório de Staff.
 */
@Injectable()
export class ActivityEventService {
  constructor(
    @InjectRepository(ActivityEvent)
    private repo: Repository<ActivityEvent>,
  ) {}

  /** Grava um evento (append-only). Sobre-registrar é aceitável (story 66). */
  async record(
    activityId: string,
    type: ActivityEventType,
    actor: ActivityUser,
    metadata: Record<string, unknown> | null = null,
  ): Promise<void> {
    const event = this.repo.create({
      activityId,
      type,
      actorUserId: actor.userId,
      metadata,
    });
    await this.repo.save(event);
  }

  /**
   * Lista os eventos da atividade em ordem cronológica decrescente (mais recente
   * primeiro). A visibilidade já foi validada pelo chamador. `actorRefs` resolve o
   * nome do ator (staff) por userId.
   */
  async findAll(
    activityId: string,
    actorRefs: Map<string, { id: string; name: string; userId: string }>,
  ): Promise<ActivityEventDto[]> {
    const events = await this.repo.find({
      where: { activityId },
      order: { createdAt: 'DESC' },
    });
    return events.map((e) => this.toView(e, actorRefs.get(e.actorUserId) ?? null));
  }

  /** userIds dos atores de uma atividade (para resolver nomes na listagem). */
  async actorUserIds(activityId: string): Promise<string[]> {
    const events = await this.repo.find({
      where: { activityId },
      select: { actorUserId: true },
    });
    return events.map((e) => e.actorUserId);
  }

  private toView(
    e: ActivityEvent,
    actor: { id: string; name: string; userId: string } | null,
  ): ActivityEventDto {
    return {
      id: e.id,
      activityId: e.activityId,
      type: e.type,
      actor,
      actorUserId: e.actorUserId,
      metadata: e.metadata ?? null,
      createdAt:
        e.createdAt instanceof Date ? e.createdAt.toISOString() : String(e.createdAt),
    };
  }
}
