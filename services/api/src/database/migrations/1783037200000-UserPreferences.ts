import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Story 130 — mecanismo geral de preferências por usuário. Chave-valor por
 * usuário (`user_id`, `key`, `value jsonb`), único por `(user_id, key)`: cada
 * tela grava a própria chave sem migration nova e sem sobrescrever as demais.
 *
 * `ON DELETE CASCADE`: preferência não sobrevive ao titular (higiene LGPD —
 * dado sem dono não deve permanecer).
 */
export class UserPreferences1783037200000 implements MigrationInterface {
  name = 'UserPreferences1783037200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE public.user_preferences (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL,
        key varchar(64) NOT NULL,
        value jsonb NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_preferences" PRIMARY KEY (id),
        CONSTRAINT "UQ_user_preferences_user_key" UNIQUE (user_id, key),
        CONSTRAINT "FK_user_preferences_user" FOREIGN KEY (user_id)
          REFERENCES public.users(id) ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE public.user_preferences`);
  }
}
