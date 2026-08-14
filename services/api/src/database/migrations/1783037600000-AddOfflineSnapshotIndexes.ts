import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Story 177 — índices que sustentam o snapshot offline da casa
 * (`GET /houses/:houseId/offline-snapshot`).
 *
 * O endpoint agrega, num payload só, tudo que o `ops.fonte` precisa da casa e,
 * com `since`, **apenas o que mudou**. Todo bloco do delta filtra por
 * `updated_at > :since` (ou `created_at`, no caso append-only do consentimento)
 * dentro de um escopo — casa, no caso dos filhos; lote de filhos, nos detalhes.
 * Sem índice composto isso é seq scan a cada volta do foreground, em todas as
 * casas ao mesmo tempo: o pior padrão possível para a rota que existe justamente
 * para poupar rede e bateria.
 *
 * Só índice — nenhuma coluna, tabela ou constraint muda, e nenhuma migration
 * existente é tocada. `IF NOT EXISTS` porque `IDX_follow_ups_resident_id` (do
 * schema inicial) já cobre parte do acesso: o composto o supera, mas a migration
 * precisa ser idempotente em bases que já receberam ajuste manual.
 */
export class AddOfflineSnapshotIndexes1783037600000 implements MigrationInterface {
  name = 'AddOfflineSnapshotIndexes1783037600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Filhos presentes da casa alterados desde o último sync.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_residents_house_updated_at"
        ON public.residents (house_id, updated_at)
    `);

    // Blocos de detalhe: sempre lidos em lote (resident_id IN (...)) e, no
    // delta, recortados por updated_at.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_follow_ups_resident_updated_at"
        ON public.resident_follow_ups (resident_id, updated_at)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_resident_receivables_resident_updated_at"
        ON public.resident_receivables (resident_id, updated_at)
    `);

    // consent_records é append-only (cada concessão/revogação é linha nova), por
    // isso o recorte do delta é por created_at.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_consent_records_subject_created_at"
        ON public.consent_records (subject_type, subject_id, created_at)
    `);

    // resident_attachments não tem updated_at nem deleted_at: o snapshot manda o
    // conjunto completo do filho sempre que ele aparece no payload, então o que
    // importa aqui é o lote por resident_id.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_resident_attachments_resident_id"
        ON public.resident_attachments (resident_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS public."IDX_resident_attachments_resident_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS public."IDX_consent_records_subject_created_at"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS public."IDX_resident_receivables_resident_updated_at"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS public."IDX_follow_ups_resident_updated_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS public."IDX_residents_house_updated_at"`);
  }
}
