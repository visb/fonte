import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Story 197 — remove o vínculo filho↔ministério.
 *
 * Ministério continua existindo como organização de trabalho da casa (nome,
 * casa, líder, servos em `ministry_staff` e tarefas em `ministry_tasks`), mas
 * deixa de ter filho como membro e como líder.
 *
 * O que o `up()` faz, nesta ordem:
 * 1. zera `leader_id`/`leader_type` dos ministérios liderados por filho — sem
 *    isso sobrariam linhas apontando para um tipo de líder que o código não
 *    aceita mais (`leader_type` passa a ser só `'STAFF'`);
 * 2. dropa `residents.ministry_id` (a FK `FK_residents_ministry` cai junto);
 * 3. dropa `admissions.ministry_id`.
 *
 * ATENÇÃO — ESTA MIGRATION É DESTRUTIVA E O `down()` NÃO DEVOLVE O DADO.
 * O `down()` apenas **recria as duas colunas VAZIAS** (todas as linhas com
 * NULL) e **não** restaura o líder zerado no passo 1. Não existe backup lógico
 * do vínculo dentro desta story: quem precisar do histórico tira do backup do
 * banco ANTES de rodar isto em produção (runbook na skill `fonte-backup`).
 * A FK `FK_residents_ministry` é recriada no `down()` para a coluna voltar com
 * a mesma forma de antes — mas continua sem nenhuma linha preenchida.
 */
export class DropResidentMinistryLink1783037800000 implements MigrationInterface {
  name = 'DropResidentMinistryLink1783037800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE public.ministries
         SET leader_id = NULL, leader_type = NULL
       WHERE leader_type = 'RESIDENT'
    `);

    await queryRunner.query(`
      ALTER TABLE public.residents DROP COLUMN IF EXISTS ministry_id
    `);

    await queryRunner.query(`
      ALTER TABLE public.admissions DROP COLUMN IF EXISTS ministry_id
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Recria as colunas VAZIAS. O vínculo filho↔ministério e o líder do tipo
    // RESIDENT não voltam — ver o aviso no topo do arquivo.
    await queryRunner.query(`
      ALTER TABLE public.admissions ADD COLUMN IF NOT EXISTS ministry_id uuid
    `);

    await queryRunner.query(`
      ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS ministry_id uuid
    `);

    await queryRunner.query(`
      ALTER TABLE ONLY public.residents
        ADD CONSTRAINT "FK_residents_ministry" FOREIGN KEY (ministry_id)
        REFERENCES public.ministries(id) ON DELETE SET NULL
    `);
  }
}
