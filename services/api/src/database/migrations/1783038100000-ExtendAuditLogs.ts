import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Story 199 — auditoria de ações dos usuários.
 *
 * Só ADICIONA colunas opcionais a `audit_logs`: os registros existentes ficam
 * intactos (todas as colunas novas aceitam NULL) e continuam visíveis como
 * "detalhe indisponível". Nenhum dado é reconstruído retroativamente.
 *
 * - `outcome`/`reason`: resultado (SUCCESS/FAILURE) e motivo controlado (login).
 * - `house_id`/`previous_house_id`: casa no momento da ação; a transferência
 *   guarda os dois lados para o filtro por casa achar o evento nas duas.
 * - `parent_type`/`parent_id`: recurso principal relacionado (ex.: filho da parcela).
 * - `correlation_id`: id da requisição — eventos de um lote compartilham o valor.
 * - `changed_fields`/`changes`: diferenças `{ field, before, after, redacted }`
 *   já projetadas (máscara/remoção de dado sensível ANTES de persistir).
 * - `context`: metadados permitidos de eventos sem diff (login, documentos).
 *
 * Índices: a listagem ordena por `created_at DESC, id DESC` e filtra por
 * período + casa/usuário/ação/recurso.
 */
export class ExtendAuditLogs1783038100000 implements MigrationInterface {
  name = 'ExtendAuditLogs1783038100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
        ADD COLUMN "outcome" varchar NULL,
        ADD COLUMN "reason" varchar NULL,
        ADD COLUMN "house_id" uuid NULL,
        ADD COLUMN "previous_house_id" uuid NULL,
        ADD COLUMN "parent_type" varchar NULL,
        ADD COLUMN "parent_id" varchar NULL,
        ADD COLUMN "correlation_id" varchar NULL,
        ADD COLUMN "changed_fields" text[] NULL,
        ADD COLUMN "changes" jsonb NULL,
        ADD COLUMN "context" jsonb NULL
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_created_id" ON "audit_logs" ("created_at" DESC, "id" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_house_created" ON "audit_logs" ("house_id", "created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_previous_house" ON "audit_logs" ("previous_house_id") WHERE "previous_house_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_user_created" ON "audit_logs" ("user_id", "created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_action_created" ON "audit_logs" ("action", "created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_parent" ON "audit_logs" ("parent_id") WHERE "parent_id" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_correlation" ON "audit_logs" ("correlation_id") WHERE "correlation_id" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_correlation"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_parent"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_action_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_user_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_previous_house"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_house_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_created_id"`);
    // Perde o detalhe dos eventos gravados depois da 199 (as linhas ficam).
    await queryRunner.query(`
      ALTER TABLE "audit_logs"
        DROP COLUMN "context",
        DROP COLUMN "changes",
        DROP COLUMN "changed_fields",
        DROP COLUMN "correlation_id",
        DROP COLUMN "parent_id",
        DROP COLUMN "parent_type",
        DROP COLUMN "previous_house_id",
        DROP COLUMN "house_id",
        DROP COLUMN "reason",
        DROP COLUMN "outcome"
    `);
  }
}
