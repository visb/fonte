import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { AuditAction, AuditTargetType, PRESENT_RESIDENT_STATUSES, Role, ServantRank } from '@fonte/types';
import { AuditService, loadById } from '../audit/audit.service';
import type { AuditFieldMap } from '../audit/audit-diff';
import {
  HOUSE_AUDIT_FIELDS,
  HOUSE_PHOTO_AUDIT_FIELDS,
  HOUSE_RULE_AUDIT_FIELDS,
} from '../audit/audit-fields';
import { House } from './house.entity';
import { HousePhoto } from './house-photo.entity';
import { HouseRule } from './house-rule.entity';
import { CreateHouseDto } from './dto/create-house.dto';
import { CreateHouseRuleDto } from './dto/create-house-rule.dto';
import { UpdateHouseDto } from './dto/update-house.dto';
import { StorageService } from '../storage/storage.service';
import { HOUSE_COORDINATOR_ROLES, isHouseCoordinatorRole } from '../../common/auth/house-coordinator';

/**
 * Coordenador da casa no detalhe (story 194). Mesmas quatro colunas do resumo de
 * `GET /houses/:id/staff`: o detalhe da casa é lido por SERVANT, então devolver a
 * entidade `Staff` inteira (CPF, RG, endereço) ampliaria a superfície de dado
 * pessoal sem necessidade (LGPD art. 6, minimização).
 */
export interface HouseCoordinatorSummary {
  id: string;
  name: string;
  whatsapp: string | null;
  photoUrl: string | null;
}

/** Linha de `GET /houses/:id/staff` (story 181 + campos da story 204). */
export interface HouseStaffMember {
  id: string;
  name: string;
  whatsapp: string | null;
  photoUrl: string | null;
  role: Role;
  /** Story 207: nível espiritual do servo; `null` para coordenador/admin ou servo sem nível. */
  rank: ServantRank | null;
  ledMinistries: Array<{ id: string; name: string }>;
}

/** Decisão 7 da story 194 — o titular tem que pertencer à lista da casa. */
export const INELIGIBLE_TITULAR_MESSAGE =
  'O coordenador titular precisa ser um coordenador lotado nesta casa.';

/** Decisão 8 da story 194 — no create é impossível satisfazer a invariante. */
export const TITULAR_ON_CREATE_MESSAGE =
  'Defina o coordenador titular depois de cadastrar a casa e lotar o coordenador nela.';

@Injectable()
export class HouseService {
  constructor(
    @InjectRepository(House)
    private houseRepository: Repository<House>,
    @InjectRepository(HousePhoto)
    private photoRepository: Repository<HousePhoto>,
    @InjectRepository(HouseRule)
    private houseRuleRepo: Repository<HouseRule>,
    private storageService: StorageService,
    // Story 199 — último de propósito: os anteriores são contrato dos specs.
    private audit: AuditService,
  ) {}

  /**
   * Mapa { houseId: contagem de filhos presentes }. Fonte única de findAll/findOne.
   * Story 190: a leitura é direta no banco — o GROUP BY é trivial no volume real
   * (dezenas de casas, ~1.000 filhos) e sempre reflete o estado atual.
   */
  private async getResidentCountsMap(): Promise<Record<string, number>> {
    const rows = await this.houseRepository.manager.query<
      Array<{ houseId: string; count: string }>
    >(
      `SELECT house_id AS "houseId", COUNT(id)::int AS count
       FROM residents
       WHERE status = ANY($1) AND deleted_at IS NULL
       GROUP BY house_id`,
      [[...PRESENT_RESIDENT_STATUSES]],
    );

    const map: Record<string, number> = {};
    for (const r of rows) map[r.houseId] = Number(r.count);
    return map;
  }

  async findAll(): Promise<
    Array<House & { activeResidentsCount: number; staffCount: number; thumbnailUrl: string | null }>
  > {
    const [houses, residentMap, staffCounts, thumbnails] = await Promise.all([
      this.houseRepository.find({
        order: { name: 'ASC' },
        relations: ['coordinator'],
      }),
      this.getResidentCountsMap(),
      this.houseRepository.manager.query<Array<{ houseId: string; count: string }>>(
        `SELECT house_id AS "houseId", COUNT(DISTINCT id)::int AS count
         FROM staff
         WHERE deleted_at IS NULL
         GROUP BY house_id`,
      ),
      this.houseRepository.manager.query<Array<{ houseId: string; thumbnailUrl: string }>>(
        `SELECT DISTINCT ON (house_id) house_id AS "houseId", url AS "thumbnailUrl"
         FROM house_photos
         ORDER BY house_id, created_at ASC`,
      ),
    ]);

    const staffMap = new Map(staffCounts.map((c) => [c.houseId, Number(c.count)]));
    const thumbnailMap = new Map(thumbnails.map((t) => [t.houseId, t.thumbnailUrl]));

    return houses.map((h) =>
      Object.assign(h, {
        activeResidentsCount: residentMap[h.id] ?? 0,
        staffCount: staffMap.get(h.id) ?? 0,
        thumbnailUrl: thumbnailMap.get(h.id) ?? null,
      }),
    );
  }

  /**
   * Lista de coordenadores da casa (story 194, decisão 1): derivada de `Staff`,
   * sem tabela de junção — `house_id` + role de coordenador da casa + não
   * soft-deletado. Story 214: role de coordenador da casa = COORDINATOR **ou**
   * ADMIN (`HOUSE_COORDINATOR_ROLES`). A role mora em `users`, daí o join. O
   * titular (`coordinator_id`) aparece aqui também: ele é um coordenador da
   * casa, não uma categoria à parte.
   */
  private findCoordinators(houseId: string): Promise<HouseCoordinatorSummary[]> {
    return this.houseRepository.manager.query<HouseCoordinatorSummary[]>(
      `SELECT s.id, s.name, s.whatsapp, s.photo_url AS "photoUrl"
       FROM staff s
       JOIN users u ON u.id = s.user_id
       WHERE s.house_id = $1 AND u.role = ANY($2) AND s.deleted_at IS NULL
       ORDER BY s.name`,
      [houseId, [...HOUSE_COORDINATOR_ROLES]],
    );
  }

  async findOne(id: string): Promise<
    House & {
      activeResidentsCount: number;
      staffCount: number;
      coordinators: HouseCoordinatorSummary[];
    }
  > {
    const [house, residentMap, staffCounts, coordinators] = await Promise.all([
      this.houseRepository.findOne({
        where: { id },
        relations: ['coordinator', 'photos'],
      }),
      this.getResidentCountsMap(),
      this.houseRepository.manager.query<Array<{ count: string }>>(
        `SELECT COUNT(DISTINCT id)::int AS count FROM staff WHERE house_id = $1 AND deleted_at IS NULL`,
        [id],
      ),
      this.findCoordinators(id),
    ]);
    if (!house) throw new NotFoundException(`House ${id} not found`);
    if (house.photos) {
      house.photos.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    }
    return Object.assign(house, {
      activeResidentsCount: residentMap[id] ?? 0,
      staffCount: Number(staffCounts[0]?.count ?? 0),
      // Sempre array: a query devolve `[]` para casa sem coordenador nenhum, que
      // é estado legítimo (decisão 5) — o cliente nunca recebe `undefined`.
      coordinators,
    });
  }

  async create(dto: CreateHouseDto): Promise<House> {
    // Story 194, decisão 8: o titular só pode ser eleito depois que a casa existe
    // (o staff precisa ter `house_id` dela). Recusar é melhor que aceitar um
    // vínculo que a invariante do update rejeitaria no request seguinte.
    if (dto.coordinatorId) throw new BadRequestException(TITULAR_ON_CREATE_MESSAGE);
    // Clear before saving: partial unique index rejects two mother houses at once.
    if (dto.isMotherHouse) await this.clearOtherMotherHouses();
    return this.trackHouse(undefined, AuditAction.HOUSE_CREATE, (m) => {
      const repo = m.getRepository(House);
      return repo.save(repo.create(dto));
    });
  }

  async update(id: string, dto: UpdateHouseDto): Promise<House> {
    const count = await this.houseRepository.count({ where: { id } });
    if (!count) throw new NotFoundException(`House ${id} not found`);
    // `undefined` não mexe na coluna; `null` limpa o titular (decisão 5).
    if (dto.coordinatorId != null) await this.assertEligibleTitular(dto.coordinatorId, id);
    // Clear before updating: partial unique index rejects two mother houses at once.
    if (dto.isMotherHouse) await this.clearOtherMotherHouses(id);
    await this.trackHouse(id, AuditAction.HOUSE_UPDATE, (m) => m.getRepository(House).update(id, dto));
    return this.findOne(id);
  }

  /** Story 199 — escrita na casa com antes/depois na mesma transação. */
  private trackHouse<R>(
    id: string | undefined,
    action: string,
    write: (manager: EntityManager) => Promise<R>,
  ): Promise<R> {
    return this.audit.track<R>({
      action,
      targetType: AuditTargetType.HOUSE,
      targetId: id,
      fields: HOUSE_AUDIT_FIELDS,
      load: loadById(House),
      lockTable: id ? 'houses' : undefined,
      resolveId: (result) => (result as unknown as House).id,
      scope: ({ before, after }) => ({ houseId: ((after ?? before)?.id as string | undefined) ?? id ?? null }),
      write,
    });
  }

  /** Story 199 — foto/regra da casa: recurso filho com a casa como principal. */
  private trackHouseChild<R>(
    houseId: string,
    targetId: string | undefined,
    action: string,
    targetType: string,
    entity: typeof HousePhoto | typeof HouseRule,
    fields: AuditFieldMap,
    write: (manager: EntityManager) => Promise<R>,
  ): Promise<R> {
    return this.audit.track<R>({
      action,
      targetType,
      targetId,
      fields,
      load: loadById(entity),
      resolveId: (result) => (result as unknown as { id: string }).id,
      scope: () => ({ houseId, parentType: AuditTargetType.HOUSE, parentId: houseId }),
      write,
    });
  }

  /**
   * Story 194, decisão 7: o titular tem que estar na lista derivada da casa —
   * coordenador da casa (COORDINATOR ou ADMIN, story 214), lotado NESTA casa,
   * não desligado. Falha é 400, não 404: o staff
   * existe, o vínculo é que está errado.
   */
  private async assertEligibleTitular(staffId: string, houseId: string): Promise<void> {
    const [staff] = await this.houseRepository.manager.query<
      Array<{ id: string; houseId: string | null; role: string; deletedAt: Date | null }>
    >(
      `SELECT s.id, s.house_id AS "houseId", u.role AS role, s.deleted_at AS "deletedAt"
       FROM staff s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = $1`,
      [staffId],
    );
    if (!staff) throw new BadRequestException(INELIGIBLE_TITULAR_MESSAGE);
    if (staff.deletedAt !== null) throw new BadRequestException(INELIGIBLE_TITULAR_MESSAGE);
    if (!isHouseCoordinatorRole(staff.role)) throw new BadRequestException(INELIGIBLE_TITULAR_MESSAGE);
    if (staff.houseId !== houseId) throw new BadRequestException(INELIGIBLE_TITULAR_MESSAGE);
  }

  /** Only one house can be the mother house; unmark all others. */
  private async clearOtherMotherHouses(keepId?: string): Promise<void> {
    const qb = this.houseRepository
      .createQueryBuilder()
      .update(House)
      .set({ isMotherHouse: false })
      .where('is_mother_house = true');
    if (keepId) qb.andWhere('id != :keepId', { keepId });
    await qb.execute();
  }

  async remove(id: string): Promise<void> {
    const count = await this.houseRepository.count({ where: { id } });
    if (!count) throw new NotFoundException(`House ${id} not found`);
    await this.trackHouse(id, AuditAction.HOUSE_DELETE, (m) => m.getRepository(House).softDelete(id));
  }

  async addPhoto(houseId: string, file: Express.Multer.File): Promise<HousePhoto> {
    const count = await this.houseRepository.count({ where: { id: houseId } });
    if (!count) throw new NotFoundException(`House ${houseId} not found`);
    const filename = this.storageService.uniqueFilename(file.originalname);
    const url = await this.storageService.upload('houses', filename, file.buffer, file.mimetype);
    return this.trackHouseChild(
      houseId,
      undefined,
      AuditAction.HOUSE_PHOTO_ADD,
      AuditTargetType.HOUSE_PHOTO,
      HousePhoto,
      HOUSE_PHOTO_AUDIT_FIELDS,
      (m) => {
        const repo = m.getRepository(HousePhoto);
        return repo.save(repo.create({ houseId, filename: file.originalname, path: url, url }));
      },
    );
  }

  async removePhoto(houseId: string, photoId: string): Promise<void> {
    const photo = await this.photoRepository.findOne({
      where: { id: photoId, houseId },
    });
    if (!photo) throw new NotFoundException(`Photo ${photoId} not found`);
    await this.storageService.delete(photo.url);
    await this.trackHouseChild(
      houseId,
      photoId,
      AuditAction.HOUSE_PHOTO_REMOVE,
      AuditTargetType.HOUSE_PHOTO,
      HousePhoto,
      HOUSE_PHOTO_AUDIT_FIELDS,
      (m) => m.getRepository(HousePhoto).delete(photoId),
    );
  }

  // ─── Residents ──────────────────────────────────────────────────────────────

  async findResidents(houseId: string): Promise<
    Array<{
      id: string;
      name: string;
      status: string;
      entryDate: string | null;
      photoUrl: string | null;
      photoThumbUrl: string | null;
    }>
  > {
    await this.assertHouseExists(houseId);
    return this.houseRepository.manager.query(
      `SELECT id, name, status, entry_date AS "entryDate",
              photo_url AS "photoUrl", photo_thumb_url AS "photoThumbUrl"
       FROM residents
       WHERE house_id = $1 AND deleted_at IS NULL
       ORDER BY name`,
      [houseId],
    );
  }

  // ─── Staff ──────────────────────────────────────────────────────────────────

  /**
   * Resumo dos servos da casa (story 181): as colunas mínimas para a aba Servos
   * do detalhe da casa e os dropdowns de ministério. Segue sendo `SELECT` cru e
   * enxuto de propósito — a rota é lida por SERVANT e devolver o registro
   * completo (e-mail, documentos, ex-filho) ampliaria a superfície de dado pessoal sem
   * necessidade (LGPD art. 6, minimização).
   *
   * Story 204: soma `role` (do `User` ligado) e `ledMinistries` (ministérios não
   * excluídos que o servo lidera) para a lista de servos do `ops`. Aditivo — os
   * consumidores antigos ignoram os campos novos.
   *
   * Story 207: soma `rank` (nível do servo) para o badge de nível no `ops`.
   */
  async findStaffForHouse(houseId: string): Promise<HouseStaffMember[]> {
    await this.assertHouseExists(houseId);
    return this.houseRepository.manager.query(
      `SELECT s.id, s.name, s.whatsapp, s.photo_url AS "photoUrl", u.role, s.rank,
              COALESCE(
                json_agg(json_build_object('id', m.id, 'name', m.name) ORDER BY m.name)
                  FILTER (WHERE m.id IS NOT NULL),
                '[]'
              ) AS "ledMinistries"
       FROM staff s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN ministries m
         ON m.leader_type = 'STAFF' AND m.leader_id = s.id AND m.deleted_at IS NULL
       WHERE s.house_id = $1 AND s.deleted_at IS NULL
       GROUP BY s.id, u.role
       ORDER BY s.name`,
      [houseId],
    );
  }

  // ─── Rules ──────────────────────────────────────────────────────────────────

  async findRules(houseId: string): Promise<HouseRule[]> {
    await this.assertHouseExists(houseId);
    return this.houseRuleRepo.find({ where: { houseId }, order: { createdAt: 'ASC' } });
  }

  async createRule(houseId: string, dto: CreateHouseRuleDto): Promise<HouseRule> {
    await this.assertHouseExists(houseId);
    return this.trackHouseChild(
      houseId,
      undefined,
      AuditAction.HOUSE_RULE_CREATE,
      AuditTargetType.HOUSE_RULE,
      HouseRule,
      HOUSE_RULE_AUDIT_FIELDS,
      (m) => {
        const repo = m.getRepository(HouseRule);
        return repo.save(repo.create({ houseId, ...dto }));
      },
    );
  }

  async removeRule(houseId: string, ruleId: string): Promise<void> {
    const rule = await this.houseRuleRepo.findOne({ where: { id: ruleId, houseId } });
    if (!rule) throw new NotFoundException(`Rule ${ruleId} not found`);
    await this.trackHouseChild(
      houseId,
      ruleId,
      AuditAction.HOUSE_RULE_DELETE,
      AuditTargetType.HOUSE_RULE,
      HouseRule,
      HOUSE_RULE_AUDIT_FIELDS,
      (m) => m.getRepository(HouseRule).softDelete(ruleId),
    );
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  async assertHouseExists(houseId: string): Promise<void> {
    const count = await this.houseRepository.count({ where: { id: houseId } });
    if (!count) throw new NotFoundException(`House ${houseId} not found`);
  }
}
