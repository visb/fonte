import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, IsNull, Repository } from 'typeorm';
import { ReceivableProductContribution } from './receivable-product-contribution.entity';
import { ResidentReceivable } from './resident-receivable.entity';
import { Staff } from '../staff/staff.entity';
import { DeclareProductContributionDto } from './dto/declare-product-contribution.dto';

export interface ProductContributionView {
  id: string;
  receivableId: string;
  inventoryItemId: string | null;
  inventoryMovementId: string | null;
  description: string | null;
  quantity: number | null;
  unit: string | null;
  pendingDetailing: boolean;
  createdByName: string | null;
  createdAt: Date;
}

@Injectable()
export class ReceivableProductContributionService {
  constructor(
    @InjectRepository(ReceivableProductContribution)
    private repo: Repository<ReceivableProductContribution>,
    @InjectRepository(ResidentReceivable)
    private receivableRepo: Repository<ResidentReceivable>,
    @InjectRepository(Staff)
    private staffRepo: Repository<Staff>,
    private dataSource: DataSource,
  ) {}

  /**
   * Declara uma ou mais linhas de contribuição em produtos numa parcela.
   * Modo catálogo lança o movimento IN atômico (estoque sobe) e grava o vínculo;
   * modo avulso apenas registra a linha com `pendingDetailing = true`.
   */
  async declare(
    residentId: string,
    receivableId: string,
    dto: DeclareProductContributionDto,
    staffUserId: string,
  ): Promise<ProductContributionView[]> {
    const receivable = await this.receivableRepo.findOne({
      where: { id: receivableId, residentId },
    });
    if (!receivable) throw new NotFoundException(`Receivable ${receivableId} not found`);

    const staff = await this.staffRepo.findOne({ where: { userId: staffUserId } });

    const created: ReceivableProductContribution[] = [];

    for (const line of dto.lines) {
      const hasItem = line.inventoryItemId != null && line.inventoryItemId !== '';
      const hasDescription = line.description != null && line.description !== '';

      // Redundância defensiva ao class-validator: item XOR descrição.
      if (hasItem === hasDescription) {
        throw new BadRequestException(
          'Cada linha deve ter item (catálogo) OU descrição (avulso), nunca ambos.',
        );
      }

      if (hasItem) {
        if (!(typeof line.quantity === 'number' && line.quantity > 0)) {
          throw new BadRequestException('Quantidade deve ser maior que zero no modo catálogo.');
        }
        if (!staff) {
          throw new BadRequestException('Staff responsável não encontrado para lançar o movimento.');
        }
        created.push(
          await this.createCatalogContribution(receivableId, line.inventoryItemId!, line.quantity, staff),
        );
      } else {
        created.push(
          await this.repo.save(
            this.repo.create({
              receivableId,
              inventoryItemId: null,
              inventoryMovementId: null,
              description: line.description!,
              quantity: typeof line.quantity === 'number' ? line.quantity : null,
              unit: line.unit ?? null,
              pendingDetailing: true,
              createdById: staff?.id ?? null,
            }),
          ),
        );
      }
    }

    return this.loadViews(created.map((c) => c.id));
  }

  /**
   * Modo catálogo: numa transação, sobe o estoque do item, cria o movimento IN
   * e grava a linha de contribuição com o vínculo `inventoryMovementId`.
   */
  private async createCatalogContribution(
    receivableId: string,
    inventoryItemId: string,
    quantity: number,
    staff: Staff,
  ): Promise<ReceivableProductContribution> {
    return this.dataSource.transaction(async (manager) => {
      const item = await this.lockItem(manager, inventoryItemId);

      const newQty = Number(item.current_quantity) + quantity;
      await manager.query(
        `UPDATE inventory_items SET current_quantity = $1, updated_at = now() WHERE id = $2`,
        [newQty, item.id],
      );

      const [movement] = (await manager.query(
        `INSERT INTO inventory_movements (kind, item_id, type, quantity, responsible_id, notes, date)
         VALUES ($1, $2, 'IN', $3, $4, $5, CURRENT_DATE)
         RETURNING id`,
        [
          item.kind,
          item.id,
          quantity,
          staff.id,
          `Contribuição em produtos da parcela ${receivableId}`,
        ],
      )) as { id: string }[];

      const contribution = manager.getRepository(ReceivableProductContribution).create({
        receivableId,
        inventoryItemId: item.id,
        inventoryMovementId: movement.id,
        description: null,
        quantity,
        unit: item.unit,
        pendingDetailing: false,
        createdById: staff.id,
      });
      return manager.getRepository(ReceivableProductContribution).save(contribution);
    });
  }

  /** Lista as contribuições de produto de uma parcela. */
  async listByReceivable(residentId: string, receivableId: string): Promise<ProductContributionView[]> {
    const receivable = await this.receivableRepo.findOne({
      where: { id: receivableId, residentId },
    });
    if (!receivable) throw new NotFoundException(`Receivable ${receivableId} not found`);

    const rows = await this.repo.find({
      where: { receivableId, deletedAt: IsNull() },
      relations: ['createdBy'],
      order: { createdAt: 'ASC' },
    });
    return rows.map((r) => this.toView(r));
  }

  /**
   * Remove uma linha (soft delete). No modo catálogo, SEM ESTORNO: cria um
   * movimento de correção (OUT) — o IN original permanece (`BUSINESS_RULES.md`).
   */
  async remove(
    residentId: string,
    receivableId: string,
    contributionId: string,
    staffUserId: string,
  ): Promise<void> {
    const receivable = await this.receivableRepo.findOne({
      where: { id: receivableId, residentId },
    });
    if (!receivable) throw new NotFoundException(`Receivable ${receivableId} not found`);

    const contribution = await this.repo.findOne({ where: { id: contributionId, receivableId } });
    if (!contribution) throw new NotFoundException(`Contribution ${contributionId} not found`);

    const staff = await this.staffRepo.findOne({ where: { userId: staffUserId } });

    if (contribution.inventoryItemId && contribution.quantity != null) {
      await this.correctCatalogContribution(contribution, staff);
    } else {
      await this.repo.softDelete(contribution.id);
    }
  }

  /** Correção sem estorno: movimento OUT do mesmo valor + soft delete da linha. */
  private async correctCatalogContribution(
    contribution: ReceivableProductContribution,
    staff: Staff | null,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const item = await this.lockItem(manager, contribution.inventoryItemId!);

      const newQty = Number(item.current_quantity) - Number(contribution.quantity);
      const clampedQty = newQty < 0 ? 0 : newQty;
      await manager.query(
        `UPDATE inventory_items SET current_quantity = $1, updated_at = now() WHERE id = $2`,
        [clampedQty, item.id],
      );

      await manager.query(
        `INSERT INTO inventory_movements (kind, item_id, type, quantity, responsible_id, notes, date)
         VALUES ($1, $2, 'OUT', $3, $4, $5, CURRENT_DATE)`,
        [
          item.kind,
          item.id,
          Number(contribution.quantity),
          staff?.id ?? item.first_responsible_id,
          `Correção: remoção da contribuição em produtos ${contribution.id}`,
        ],
      );

      await manager.getRepository(ReceivableProductContribution).softDelete(contribution.id);
    });
  }

  /** Batch: contribuições agrupadas por parcela — alimenta a view do carnê. */
  async mapByReceivables(receivableIds: string[]): Promise<Map<string, ProductContributionView[]>> {
    const map = new Map<string, ProductContributionView[]>();
    if (receivableIds.length === 0) return map;

    const rows = await this.repo.find({
      where: { receivableId: In(receivableIds), deletedAt: IsNull() },
      relations: ['createdBy'],
      order: { createdAt: 'ASC' },
    });

    for (const row of rows) {
      const list = map.get(row.receivableId) ?? [];
      list.push(this.toView(row));
      map.set(row.receivableId, list);
    }
    return map;
  }

  private async lockItem(
    manager: EntityManager,
    inventoryItemId: string,
  ): Promise<{ id: string; kind: string; unit: string; current_quantity: string; first_responsible_id: string | null }> {
    const rows = (await manager.query(
      `SELECT i.id, i.kind, i.unit, i.current_quantity,
              (SELECT m.responsible_id FROM inventory_movements m WHERE m.item_id = i.id LIMIT 1) AS first_responsible_id
         FROM inventory_items i
        WHERE i.id = $1 AND i.deleted_at IS NULL
        FOR UPDATE OF i`,
      [inventoryItemId],
    )) as {
      id: string;
      kind: string;
      unit: string;
      current_quantity: string;
      first_responsible_id: string | null;
    }[];
    if (!rows.length) throw new NotFoundException(`Inventory item ${inventoryItemId} not found`);
    return rows[0];
  }

  private async loadViews(ids: string[]): Promise<ProductContributionView[]> {
    if (ids.length === 0) return [];
    const rows = await this.repo.find({
      where: { id: In(ids) },
      relations: ['createdBy'],
      order: { createdAt: 'ASC' },
    });
    return rows.map((r) => this.toView(r));
  }

  private toView(row: ReceivableProductContribution): ProductContributionView {
    return {
      id: row.id,
      receivableId: row.receivableId,
      inventoryItemId: row.inventoryItemId,
      inventoryMovementId: row.inventoryMovementId,
      description: row.description,
      quantity: row.quantity != null ? Number(row.quantity) : null,
      unit: row.unit,
      pendingDetailing: row.pendingDetailing,
      createdByName: (row.createdBy as Staff | null)?.name ?? null,
      createdAt: row.createdAt,
    };
  }
}
