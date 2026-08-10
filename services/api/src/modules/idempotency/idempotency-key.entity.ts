import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

export enum IdempotencyStatus {
  /** Reserva feita, handler ainda executando. Duplicata nesse estado recebe 409. */
  IN_PROGRESS = 'IN_PROGRESS',
  /** Handler terminou com sucesso; `responseStatus`/`responseBody` são o que a duplicata recebe. */
  COMPLETED = 'COMPLETED',
}

/**
 * Story 172 — reserva/memória de uma requisição de escrita identificada pelo
 * header `Idempotency-Key`. Escopo `(key, userId, httpMethod, path)`: chave
 * repetida por outro usuário ou em outra rota não colide (decisão 6).
 *
 * Tabela operacional, não registro de domínio: sem soft delete, purgada aos 7
 * dias (`IdempotencyService.purgeExpired`).
 */
@Entity('idempotency_keys')
@Unique('UQ_idempotency_keys_scope', ['key', 'userId', 'httpMethod', 'path'])
export class IdempotencyKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Valor cru do header `Idempotency-Key` (validado como UUID pelo interceptor). */
  @Column({ type: 'varchar', length: 64 })
  key: string;

  /** Dono da requisição, vindo do JWT. Sem ele não há escopo — a rota passa direto. */
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'http_method', type: 'varchar', length: 10 })
  httpMethod: string;

  /** Caminho da requisição sem querystring (ex.: `/api/v1/storerooms/movements`). */
  @Column({ type: 'varchar', length: 512 })
  path: string;

  @Column({ type: 'varchar', length: 20, default: IdempotencyStatus.IN_PROGRESS })
  status: IdempotencyStatus;

  @Column({ name: 'response_status', type: 'int', nullable: true })
  responseStatus: number | null;

  @Column({ name: 'response_body', type: 'jsonb', nullable: true })
  responseBody: unknown;

  @Index()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;
}
