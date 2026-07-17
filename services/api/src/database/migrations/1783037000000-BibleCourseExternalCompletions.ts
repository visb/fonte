import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Story 127 — marcação "já fez o curso bíblico fora do sistema".
 *
 * Fato histórico do filho (não do acolhimento): sobrevive a alta/evasão/
 * readmissão e tira o filho da lista de sugestões de matrícula para sempre.
 * Tabela própria do módulo `bible-course` (CLAUDE.md proíbe tocar tabela de
 * outro módulo) — dá auditoria de quem/quando e o desfazer vira soft delete.
 */
export class BibleCourseExternalCompletions1783037000000 implements MigrationInterface {
  name = 'BibleCourseExternalCompletions1783037000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE public.bible_course_external_completions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    resident_id uuid NOT NULL,
    marked_by uuid,
    marked_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone
)`);

    await queryRunner.query(`ALTER TABLE ONLY public.bible_course_external_completions
      ADD CONSTRAINT "PK_bible_course_external_completions" PRIMARY KEY (id)`);

    await queryRunner.query(`ALTER TABLE ONLY public.bible_course_external_completions
      ADD CONSTRAINT "FK_bible_course_external_completions_resident"
      FOREIGN KEY (resident_id) REFERENCES public.residents(id) ON DELETE CASCADE`);

    // SET NULL (não CASCADE): staff desligado não apaga o fato de que o filho
    // fez o curso — só perde o rastro de quem marcou.
    await queryRunner.query(`ALTER TABLE ONLY public.bible_course_external_completions
      ADD CONSTRAINT "FK_bible_course_external_completions_marked_by"
      FOREIGN KEY (marked_by) REFERENCES public.users(id) ON DELETE SET NULL`);

    // No máximo uma marcação ativa por filho. Desmarcar (soft delete) e marcar
    // de novo cria linha nova — histórico preservado.
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_bible_course_external_completions_active"
      ON public.bible_course_external_completions (resident_id)
      WHERE deleted_at IS NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE public.bible_course_external_completions`);
  }
}
