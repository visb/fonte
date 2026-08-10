import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { IdempotencyKey, IdempotencyStatus } from './idempotency-key.entity';

/** Tupla que identifica uma requisição idempotente (decisão 6 da story 172). */
export interface IdempotencyScope {
  key: string;
  userId: string;
  httpMethod: string;
  path: string;
}

/**
 * Retenção da memória de respostas. 7 dias cobre com folga o pior caso de
 * operador offline (fila drenada quando volta à casa); guardar resposta
 * serializada além disso é acúmulo de dado pessoal sem finalidade (LGPD).
 * Constante de propósito — não é configurável por env (fora de escopo).
 */
export const IDEMPOTENCY_RETENTION_DAYS = 7;

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(
    @InjectRepository(IdempotencyKey)
    private readonly repo: Repository<IdempotencyKey>,
  ) {}

  /**
   * Reserva a chave ANTES de executar o handler (decisão 5). Devolve `null`
   * quando o insert viola o unique — nesse caso a requisição é duplicata e quem
   * chama decide entre replay e 409. É o unique do banco que resolve duas cópias
   * simultâneas; "consultar antes de inserir" tem corrida.
   */
  async reserve(scope: IdempotencyScope): Promise<IdempotencyKey | null> {
    try {
      return await this.repo.save(
        this.repo.create({ ...scope, status: IdempotencyStatus.IN_PROGRESS }),
      );
    } catch (error) {
      if (isUniqueViolation(error)) return null;
      throw error;
    }
  }

  findByScope(scope: IdempotencyScope): Promise<IdempotencyKey | null> {
    return this.repo.findOne({ where: { ...scope } });
  }

  /**
   * Memoriza a resposta de sucesso. Best-effort: uma falha aqui não pode
   * derrubar a escrita de negócio que já aconteceu — a reserva fica
   * `IN_PROGRESS` e o reenvio recebe 409 (transitório), nunca uma duplicata.
   */
  async complete(id: string, responseStatus: number, responseBody: unknown): Promise<void> {
    try {
      // `responseBody` é JSON livre (coluna jsonb tipada como `unknown`) e o
      // partial do TypeORM não aceita `unknown` — mesmo cast do PreferenceService.
      const patch = {
        status: IdempotencyStatus.COMPLETED,
        responseStatus,
        responseBody: responseBody ?? null,
        completedAt: new Date(),
      } as unknown as Parameters<Repository<IdempotencyKey>['update']>[1];
      await this.repo.update(id, patch);
    } catch (error) {
      this.logger.warn(`Falha ao memorizar resposta idempotente ${id}: ${describe(error)}`);
    }
  }

  /**
   * Apaga a reserva quando o handler falha (decisão 7): erro não pode ficar
   * cacheado, senão o operador nunca consegue corrigir e reenviar. Best-effort
   * pelo mesmo motivo do `complete`.
   */
  async release(id: string): Promise<void> {
    try {
      await this.repo.delete(id);
    } catch (error) {
      this.logger.warn(`Falha ao liberar reserva idempotente ${id}: ${describe(error)}`);
    }
  }

  /** Remove as chaves fora da janela de retenção. Devolve quantas saíram. */
  async purgeExpired(): Promise<{ removed: number }> {
    const cutoff = new Date(Date.now() - IDEMPOTENCY_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const result = await this.repo.delete({ createdAt: LessThan(cutoff) });
    return { removed: result.affected ?? 0 };
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async scheduledPurge(): Promise<void> {
    const { removed } = await this.purgeExpired();
    if (removed > 0) this.logger.log(`Idempotência: ${removed} chave(s) expirada(s) removida(s).`);
  }
}

/** `23505` = unique_violation no Postgres, tanto no erro cru quanto no wrapper do TypeORM. */
function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: string; driverError?: { code?: string } } | null;
  return (e?.driverError?.code ?? e?.code) === '23505';
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
