import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Story 219 — CPF do filho único.
 *
 * Ordem (decisão 6):
 *   (a) normaliza todo CPF para só dígitos (`123.456.789-09` e `12345678909`
 *       são o mesmo CPF); vazio vira `NULL`;
 *   (b) dedup com log: em cada grupo de CPF repetido entre filhos não excluídos
 *       fica com o CPF o filho em acolhimento (status não terminal); empate → o
 *       de `updated_at` mais recente (decisão 4). Os demais são copiados para
 *       `resident_cpf_dedup_log` e ficam com `cpf = NULL` (decisão 5);
 *   (c) índice único parcial `UX_residents_cpf_active` (decisão 1/7):
 *       soft-deletado não conta.
 *
 * `down` restaura os CPFs a partir do log, derruba o índice e o log. A
 * normalização (a) não é desfeita: a máscara não carrega informação.
 */
export class UniqueResidentCpf1783038400000 implements MigrationInterface {
  name = 'UniqueResidentCpf1783038400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE public.residents
         SET cpf = NULLIF(regexp_replace(cpf, '\\D', '', 'g'), '')
       WHERE cpf IS NOT NULL AND cpf !~ '^[0-9]+$'
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.resident_cpf_dedup_log (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        resident_id uuid NOT NULL,
        old_cpf character varying NOT NULL,
        kept_resident_id uuid NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_resident_cpf_dedup_log" PRIMARY KEY (id)
      )
    `);

    await queryRunner.query(`
      WITH ranked AS (
        SELECT id, cpf,
               first_value(id) OVER w AS kept_id,
               row_number() OVER w AS position
          FROM public.residents
         WHERE cpf IS NOT NULL AND deleted_at IS NULL
        WINDOW w AS (
          PARTITION BY cpf
          ORDER BY (status IN ('PRE_ADMISSION', 'ACTIVE', 'DISCIPLINE', 'TEMP_LEAVE', 'CENSUS_ADDED')) DESC,
                   updated_at DESC,
                   id ASC
        )
      ),
      logged AS (
        INSERT INTO public.resident_cpf_dedup_log (resident_id, old_cpf, kept_resident_id)
        SELECT id, cpf, kept_id FROM ranked WHERE position > 1
        RETURNING resident_id
      )
      UPDATE public.residents
         SET cpf = NULL, updated_at = now()
       WHERE id IN (SELECT resident_id FROM logged)
    `);

    const stats = (await queryRunner.query(`
      SELECT count(DISTINCT kept_resident_id)::int AS groups, count(*)::int AS cleared
        FROM public.resident_cpf_dedup_log
    `)) as Array<{ groups: number; cleared: number }> | undefined;
    const { groups = 0, cleared = 0 } = stats?.[0] ?? {};
    console.log(`[UniqueResidentCpf] grupos de CPF repetido: ${groups}; filhos com CPF limpo: ${cleared}`);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UX_residents_cpf_active"
        ON public.residents (cpf)
        WHERE cpf IS NOT NULL AND deleted_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS public."UX_residents_cpf_active"`);
    await queryRunner.query(`
      UPDATE public.residents r
         SET cpf = l.old_cpf
        FROM public.resident_cpf_dedup_log l
       WHERE l.resident_id = r.id AND r.cpf IS NULL
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS public.resident_cpf_dedup_log`);
  }
}
