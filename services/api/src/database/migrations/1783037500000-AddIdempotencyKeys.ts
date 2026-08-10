import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Story 172 — idempotência de escrita via header `Idempotency-Key`.
 *
 * Tabela genérica (decisão 2): o `IdempotencyInterceptor` reserva a chave antes
 * de chamar o handler e memoriza a resposta de sucesso. Nenhum módulo de domínio
 * ganha coluna própria.
 *
 * O **unique** `(key, user_id, http_method, path)` é o coração do mecanismo
 * (decisões 5 e 6): é ele — e não um "select antes de inserir", que tem corrida —
 * que resolve duas cópias simultâneas do mesmo lançamento reenviado pela outbox
 * do ops. O `user_id` no escopo impede que a chave de um cliente devolva a
 * resposta memorizada de outro.
 *
 * Sem `deleted_at`: é tabela operacional, some na purga de 7 dias
 * (`IdempotencyService.purgeExpired`), não é registro de domínio. O índice em
 * `created_at` existe para essa purga.
 */
export class AddIdempotencyKeys1783037500000 implements MigrationInterface {
  name = 'AddIdempotencyKeys1783037500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE public.idempotency_keys (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        key varchar(64) NOT NULL,
        user_id uuid NOT NULL,
        http_method varchar(10) NOT NULL,
        path varchar(512) NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'IN_PROGRESS',
        response_status integer NULL,
        response_body jsonb NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        completed_at TIMESTAMP WITH TIME ZONE NULL,
        CONSTRAINT "PK_idempotency_keys" PRIMARY KEY (id),
        CONSTRAINT "UQ_idempotency_keys_scope" UNIQUE (key, user_id, http_method, path)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_idempotency_keys_created_at"
        ON public.idempotency_keys (created_at)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS public."IDX_idempotency_keys_created_at"`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.idempotency_keys`);
  }
}
