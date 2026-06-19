import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Activity as ActivityDto, ActivityStatus, Role } from '@fonte/types';
import { Activity } from './activity.entity';
import { Staff } from '../staff/staff.entity';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { ChangeActivityStatusDto } from './dto/change-activity-status.dto';
import { ListActivitiesQueryDto } from './dto/list-activities.dto';

/** Identidade autenticada que o service precisa (JWT não carrega houseId). */
export interface ActivityUser {
  userId: string;
  role: string;
}

/**
 * Matriz de transições válidas entre colunas do board (adjacência do fluxo).
 * Definida explicitamente — o backend é a autoridade.
 *
 *   DRAFT      → REQUESTED            (enviar)
 *   REQUESTED  → TODO                 (aprovar; exige responsável)
 *   TODO       ↔ DOING                (iniciar / voltar a fazer)
 *   DOING      ↔ BLOCKED              (impedir / desimpedir)
 *   DOING      ↔ DONE                 (concluir / reabrir)
 *   BLOCKED    → DONE                 (concluir direto de impedimento)
 */
const TRANSITIONS: Record<ActivityStatus, ActivityStatus[]> = {
  [ActivityStatus.DRAFT]: [ActivityStatus.REQUESTED],
  [ActivityStatus.REQUESTED]: [ActivityStatus.TODO],
  [ActivityStatus.TODO]: [ActivityStatus.DOING],
  [ActivityStatus.DOING]: [
    ActivityStatus.TODO,
    ActivityStatus.BLOCKED,
    ActivityStatus.DONE,
  ],
  [ActivityStatus.BLOCKED]: [ActivityStatus.DOING, ActivityStatus.DONE],
  [ActivityStatus.DONE]: [ActivityStatus.DOING],
};

/** Estágios do bloco de trabalho (responsável obrigatório, mexido por responsável/ADMIN). */
const WORK_STATUSES: ActivityStatus[] = [
  ActivityStatus.TODO,
  ActivityStatus.DOING,
  ActivityStatus.BLOCKED,
  ActivityStatus.DONE,
];

@Injectable()
export class ActivityService {
  constructor(
    @InjectRepository(Activity)
    private repo: Repository<Activity>,
    @InjectRepository(Staff)
    private staffRepo: Repository<Staff>,
  ) {}

  private isAdmin(user: ActivityUser): boolean {
    return user.role === Role.ADMIN;
  }

  /**
   * Janela de edição da DESCRIÇÃO (story 62 — substitui a janela da story 48):
   * - ADMIN edita a descrição em QUALQUER status (override).
   * - Criador edita em DRAFT, REQUESTED e TODO; a partir de DOING (e BLOCKED/DONE)
   *   fica bloqueado.
   * - Ninguém além de ADMIN/criador edita a descrição.
   * O backend é a autoridade; o front apenas espelha esta regra.
   */
  private canEditDescription(activity: Activity, user: ActivityUser): boolean {
    if (this.isAdmin(user)) return true;
    if (activity.createdByUserId !== user.userId) return false;
    return (
      activity.status === ActivityStatus.DRAFT ||
      activity.status === ActivityStatus.REQUESTED ||
      activity.status === ActivityStatus.TODO
    );
  }

  /** Resolve a casa do staff autenticado (null se não houver). Lazy via Staff repo. */
  async resolveHouseId(user: ActivityUser): Promise<string | null> {
    const staff = await this.staffRepo.findOne({
      where: { userId: user.userId },
    });
    return staff?.houseId ?? null;
  }

  /** Visibilidade: ADMIN vê tudo; demais só a própria casa (e nunca houseless). */
  private assertVisible(
    activity: Activity,
    user: ActivityUser,
    houseId: string | null,
  ): void {
    if (this.isAdmin(user)) return;
    if (!houseId || activity.houseId !== houseId) {
      throw new NotFoundException('Activity not found');
    }
  }

  /** Transição permitida pela matriz (independente de quem). */
  private canTransition(from: ActivityStatus, to: ActivityStatus): boolean {
    return TRANSITIONS[from]?.includes(to) ?? false;
  }

  async findAll(
    user: ActivityUser,
    filters: ListActivitiesQueryDto,
  ): Promise<ActivityDto[]> {
    const qb = this.repo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.house', 'house')
      .leftJoinAndSelect('a.responsible', 'responsible')
      .orderBy('a.updated_at', 'DESC');

    if (this.isAdmin(user)) {
      if (filters.houseId) qb.andWhere('a.house_id = :houseId', { houseId: filters.houseId });
    } else {
      // COORD/SERVANT: força a própria casa e exclui houseless.
      const houseId = await this.resolveHouseId(user);
      if (!houseId) return [];
      qb.andWhere('a.house_id = :houseId', { houseId });
    }

    if (filters.status) qb.andWhere('a.status = :status', { status: filters.status });
    if (filters.responsibleStaffId) {
      qb.andWhere('a.responsible_staff_id = :rid', { rid: filters.responsibleStaffId });
    }

    const items = await qb.getMany();
    const creators = await this.resolveCreators(
      items.map((a) => a.createdByUserId),
    );
    return items.map((a) => this.toView(a, creators.get(a.createdByUserId) ?? null));
  }

  async findOne(id: string, user: ActivityUser): Promise<ActivityDto> {
    const activity = await this.loadOne(id);
    const houseId = await this.resolveHouseId(user);
    this.assertVisible(activity, user, houseId);
    const creators = await this.resolveCreators([activity.createdByUserId]);
    return this.toView(activity, creators.get(activity.createdByUserId) ?? null);
  }

  /**
   * Carrega a atividade e valida a visibilidade do usuário (mesma regra de escopo
   * por casa). Reusado por features acopladas à atividade (ex.: comentários — story
   * 65). Lança 404 se a atividade não existe ou está fora do escopo. Retorna a
   * entidade para que o chamador use seus campos (ex.: `id`).
   */
  async loadVisibleOrFail(id: string, user: ActivityUser): Promise<Activity> {
    const activity = await this.loadOne(id);
    const houseId = await this.resolveHouseId(user);
    this.assertVisible(activity, user, houseId);
    return activity;
  }

  /**
   * Resolve a referência de staff (id/nome/userId) por userId. Exposto para que
   * features acopladas (comentários) exibam o autor pelo nome. Quem não for staff
   * fica sem ref (null).
   */
  async resolveStaffRefs(
    userIds: string[],
  ): Promise<Map<string, { id: string; name: string; userId: string }>> {
    return this.resolveCreators(userIds);
  }

  /**
   * Resolve o staff criador (id, nome, userId) para cada userId informado.
   * O nome do criador vive no Staff (User não tem nome). Familiares/internos
   * não criam atividades, então quem não for staff fica sem ref (null).
   */
  private async resolveCreators(
    userIds: string[],
  ): Promise<Map<string, { id: string; name: string; userId: string }>> {
    const unique = [...new Set(userIds.filter(Boolean))];
    const map = new Map<string, { id: string; name: string; userId: string }>();
    if (unique.length === 0) return map;
    const staff = await this.staffRepo.find({
      where: unique.map((userId) => ({ userId })),
    });
    for (const s of staff) {
      if (s.userId) map.set(s.userId, { id: s.id, name: s.name, userId: s.userId });
    }
    return map;
  }

  async create(dto: CreateActivityDto, user: ActivityUser): Promise<ActivityDto> {
    const admin = this.isAdmin(user);

    // ops (não-ADMIN) só cria rascunho; ADMIN pode DRAFT ou TODO (com responsável).
    let status = ActivityStatus.DRAFT;
    if (admin && dto.status) {
      if (dto.status !== ActivityStatus.DRAFT && dto.status !== ActivityStatus.TODO) {
        throw new BadRequestException('Activity can only be created in DRAFT or TODO');
      }
      status = dto.status;
    } else if (!admin && dto.status && dto.status !== ActivityStatus.DRAFT) {
      throw new ForbiddenException('Only ADMIN can create an activity outside of DRAFT');
    }

    let responsibleStaffId = admin ? dto.responsibleStaffId ?? null : null;

    if (status === ActivityStatus.TODO) {
      // Criar direto em "a fazer" exige ADMIN + responsável.
      if (!admin) throw new ForbiddenException('Only ADMIN can create an activity in TODO');
      if (!responsibleStaffId) {
        throw new BadRequestException('A responsible staff is required for TODO');
      }
      await this.assertStaffExists(responsibleStaffId);
    }

    const activity = this.repo.create({
      title: dto.title,
      description: dto.description ?? null,
      status,
      houseId: dto.houseId ?? null,
      responsibleStaffId,
      createdByUserId: user.userId,
    });
    const saved = await this.repo.save(activity);
    return this.findOne(saved.id, user);
  }

  async update(
    id: string,
    dto: UpdateActivityDto,
    user: ActivityUser,
  ): Promise<ActivityDto> {
    const activity = await this.loadOne(id);
    const houseId = await this.resolveHouseId(user);
    this.assertVisible(activity, user, houseId);

    const admin = this.isAdmin(user);
    const isCreator = activity.createdByUserId === user.userId;

    // Edição de título/casa segue a regra da story 48: ADMIN sempre; criador só
    // enquanto DRAFT. A descrição tem janela própria (story 62) tratada abaixo.
    const editsCoreContent = dto.title !== undefined || dto.houseId !== undefined;
    if (
      editsCoreContent &&
      !admin &&
      !(isCreator && activity.status === ActivityStatus.DRAFT)
    ) {
      throw new ForbiddenException('You cannot edit this activity');
    }

    // Descrição: ADMIN em qualquer status; criador em DRAFT/REQUESTED/TODO.
    // Bloqueia a partir de DOING (story 62).
    if (dto.description !== undefined && !this.canEditDescription(activity, user)) {
      throw new ForbiddenException(
        'You cannot edit the description of this activity',
      );
    }

    if (dto.title !== undefined) activity.title = dto.title;
    if (dto.description !== undefined) activity.description = dto.description ?? null;
    if (dto.houseId !== undefined) activity.houseId = dto.houseId ?? null;

    // Reatribuir responsável: só ADMIN.
    if (dto.responsibleStaffId !== undefined) {
      if (!admin) throw new ForbiddenException('Only ADMIN can reassign the responsible');
      if (dto.responsibleStaffId) await this.assertStaffExists(dto.responsibleStaffId);
      activity.responsibleStaffId = dto.responsibleStaffId ?? null;
    }

    await this.repo.save(activity);
    return this.findOne(id, user);
  }

  async changeStatus(
    id: string,
    dto: ChangeActivityStatusDto,
    user: ActivityUser,
  ): Promise<ActivityDto> {
    const activity = await this.loadOne(id);
    const houseId = await this.resolveHouseId(user);
    this.assertVisible(activity, user, houseId);

    const from = activity.status;
    const to = dto.status;

    if (from === to) throw new BadRequestException('Activity is already in this status');
    if (!this.canTransition(from, to)) {
      throw new BadRequestException(`Invalid transition: ${from} → ${to}`);
    }

    await this.assertCanChangeStatus(activity, from, to, dto, user);

    activity.status = to;
    await this.repo.save(activity);
    return this.findOne(id, user);
  }

  /** Permissão por transição (regra de negócio). */
  private async assertCanChangeStatus(
    activity: Activity,
    from: ActivityStatus,
    to: ActivityStatus,
    dto: ChangeActivityStatusDto,
    user: ActivityUser,
  ): Promise<void> {
    const admin = this.isAdmin(user);

    // DRAFT → REQUESTED: criador ou ADMIN.
    if (from === ActivityStatus.DRAFT && to === ActivityStatus.REQUESTED) {
      if (!admin && activity.createdByUserId !== user.userId) {
        throw new ForbiddenException('Only the creator or ADMIN can submit a draft');
      }
      return;
    }

    // REQUESTED → TODO: só ADMIN, exige responsável (body ou já setado).
    if (from === ActivityStatus.REQUESTED && to === ActivityStatus.TODO) {
      if (!admin) throw new ForbiddenException('Only ADMIN can approve a request');
      const responsibleStaffId =
        dto.responsibleStaffId ?? activity.responsibleStaffId ?? null;
      if (!responsibleStaffId) {
        throw new BadRequestException('A responsible staff is required to move to TODO');
      }
      await this.assertStaffExists(responsibleStaffId);
      activity.responsibleStaffId = responsibleStaffId;
      return;
    }

    // Bloco de trabalho (TODO/DOING/BLOCKED/DONE): ADMIN ou o responsável.
    if (WORK_STATUSES.includes(from) && WORK_STATUSES.includes(to)) {
      if (admin) return;
      const responsible = activity.responsibleStaffId
        ? await this.staffRepo.findOne({ where: { id: activity.responsibleStaffId } })
        : null;
      if (!responsible || responsible.userId !== user.userId) {
        throw new ForbiddenException('Only the responsible or ADMIN can move this activity');
      }
      return;
    }

    // Qualquer outra combinação válida na matriz mas não tratada acima.
    throw new ForbiddenException('You cannot perform this transition');
  }

  async remove(id: string, user: ActivityUser): Promise<void> {
    const activity = await this.loadOne(id);
    const houseId = await this.resolveHouseId(user);
    this.assertVisible(activity, user, houseId);

    const admin = this.isAdmin(user);
    const isOwnDraft =
      activity.createdByUserId === user.userId &&
      activity.status === ActivityStatus.DRAFT;

    if (!admin && !isOwnDraft) {
      throw new ForbiddenException('You cannot delete this activity');
    }
    await this.repo.softRemove(activity);
  }

  private async loadOne(id: string): Promise<Activity> {
    const activity = await this.repo.findOne({
      where: { id },
      relations: ['house', 'responsible'],
    });
    if (!activity) throw new NotFoundException('Activity not found');
    return activity;
  }

  private async assertStaffExists(staffId: string): Promise<void> {
    const staff = await this.staffRepo.findOne({ where: { id: staffId } });
    if (!staff) throw new BadRequestException('Responsible staff not found');
  }

  private toView(
    a: Activity,
    createdBy: { id: string; name: string; userId: string } | null = null,
  ): ActivityDto {
    return {
      id: a.id,
      title: a.title,
      description: a.description ?? null,
      status: a.status,
      houseId: a.houseId ?? null,
      house: a.house ? { id: a.house.id, name: a.house.name } : null,
      responsibleStaffId: a.responsibleStaffId ?? null,
      responsible: a.responsible
        ? { id: a.responsible.id, name: a.responsible.name, userId: a.responsible.userId }
        : null,
      createdByUserId: a.createdByUserId,
      createdBy,
      createdAt:
        a.createdAt instanceof Date ? a.createdAt.toISOString() : String(a.createdAt),
      updatedAt:
        a.updatedAt instanceof Date ? a.updatedAt.toISOString() : String(a.updatedAt),
    };
  }
}
