import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Story 205 — restaura o vínculo filho↔ministério (desfaz a story 197).
 *
 * A `DropResidentMinistryLink` continua no histórico; esta migration é nova e
 * recria as duas colunas **vazias** (decisão 2: os vínculos antigos não são
 * recuperados do backup, os coordenadores refazem pelo app):
 * - `residents.ministry_id` (FK `FK_residents_ministry`, `ON DELETE SET NULL`,
 *   índice `idx_residents_ministry_id`);
 * - `admissions.ministry_id` (FK `FK_admissions_ministry`, `ON DELETE SET NULL`).
 *
 * Ministério tem soft delete, então o `ON DELETE SET NULL` só cobre exclusão
 * física; a limpeza na exclusão lógica fica em `MinistryService.remove`.
 *
 * ATENÇÃO — O `down()` DROPA AS COLUNAS: todo vínculo filho↔ministério gravado
 * depois desta migration se perde. Os ministérios liderados por filho
 * (`leader_type = 'RESIDENT'`) são zerados no `down()`, como a 197 fazia.
 */
export class RestoreResidentMinistryLink1783037900000 implements MigrationInterface {
  name = 'RestoreResidentMinistryLink1783037900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS ministry_id uuid NULL
    `);
    await queryRunner.query(`
      ALTER TABLE public.admissions ADD COLUMN IF NOT EXISTS ministry_id uuid NULL
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY public.residents
        ADD CONSTRAINT "FK_residents_ministry" FOREIGN KEY (ministry_id)
        REFERENCES public.ministries(id) ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE ONLY public.admissions
        ADD CONSTRAINT "FK_admissions_ministry" FOREIGN KEY (ministry_id)
        REFERENCES public.ministries(id) ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_residents_ministry_id ON public.residents (ministry_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Destrutivo — ver o aviso no topo do arquivo.
    await queryRunner.query(`
      UPDATE public.ministries
         SET leader_id = NULL, leader_type = NULL
       WHERE leader_type = 'RESIDENT'
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS public.idx_residents_ministry_id`);
    await queryRunner.query(`
      ALTER TABLE public.admissions DROP COLUMN IF EXISTS ministry_id
    `);
    await queryRunner.query(`
      ALTER TABLE public.residents DROP COLUMN IF EXISTS ministry_id
    `);
  }
}
