import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Story 164 — vincula cada parcela do carnê ao acolhimento a que ela pertence.
 *
 * Até aqui `resident_receivables` só conhecia `resident_id`: filho com dois
 * acolhimentos via as competências do antigo misturadas (e acionáveis) junto com
 * as do atual.
 *
 * A coluna é **nullable de propósito** (decisão 7): existe parcela de filho sem
 * nenhuma admissão viva (dado legado do import) e uma migration que quebra em
 * produção por causa disso é pior que uma coluna nullable. `ON DELETE SET NULL`
 * pelo mesmo motivo — apagar acolhimento não pode apagar histórico financeiro.
 *
 * O backfill implementa a MESMA regra de `admission-resolution.ts`
 * (`resolveAdmissionIdForMonth`), como subconsulta correlacionada — `UPDATE ...
 * FROM LATERAL` não enxerga a tabela alvo no Postgres. Ordem de desempate:
 *   1. admissões já iniciadas na competência — comparação em granularidade de MÊS
 *      (`date_trunc('month', entry_date) <= reference_month`), senão o primeiro
 *      mês de um acolhimento que entrou no dia 17 cairia no acolhimento anterior;
 *   2. entre elas, as que ainda cobrem a competência — `exit_date` nulo, ou
 *      posterior à competência, ou **inválido** (`exit_date < entry_date`, dado
 *      ruim de planilha que existe em produção e é tratado como janela aberta);
 *   3. a de maior entrada vence; nenhuma iniciada → a mais antiga.
 */
export class AddAdmissionToReceivables1783037400000 implements MigrationInterface {
  name = 'AddAdmissionToReceivables1783037400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE public.resident_receivables
        ADD COLUMN admission_id uuid NULL
    `);

    await queryRunner.query(`
      ALTER TABLE public.resident_receivables
        ADD CONSTRAINT "FK_resident_receivables_admission"
        FOREIGN KEY (admission_id) REFERENCES public.admissions(id) ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_resident_receivables_resident_admission"
        ON public.resident_receivables (resident_id, admission_id)
    `);

    await queryRunner.query(`
      UPDATE public.resident_receivables AS rr
      SET admission_id = (
        SELECT a.id
        FROM public.admissions a
        WHERE a.resident_id = rr.resident_id
          AND a.deleted_at IS NULL
        ORDER BY
          (
            a.entry_date IS NOT NULL
            AND date_trunc('month', a.entry_date)::date <= rr.reference_month
          ) DESC,
          (
            a.exit_date IS NULL
            OR (a.entry_date IS NOT NULL AND a.exit_date < a.entry_date)
            OR rr.reference_month <= a.exit_date
          ) DESC,
          CASE
            WHEN a.entry_date IS NOT NULL
             AND date_trunc('month', a.entry_date)::date <= rr.reference_month
            THEN a.entry_date
          END DESC NULLS LAST,
          a.entry_date ASC NULLS LAST,
          a.created_at ASC
        LIMIT 1
      )
      WHERE rr.admission_id IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS public."IDX_resident_receivables_resident_admission"
    `);
    await queryRunner.query(`
      ALTER TABLE public.resident_receivables
        DROP CONSTRAINT IF EXISTS "FK_resident_receivables_admission"
    `);
    await queryRunner.query(`
      ALTER TABLE public.resident_receivables DROP COLUMN admission_id
    `);
  }
}
