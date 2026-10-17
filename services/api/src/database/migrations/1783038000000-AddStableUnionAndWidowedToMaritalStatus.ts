import { MigrationInterface, QueryRunner } from 'typeorm';

const ENUM_TABLES = [
  { type: 'residents_marital_status_enum', table: 'residents' },
  { type: 'staff_marital_status_enum', table: 'staff' },
] as const;

const NEW_VALUES = ['STABLE_UNION', 'WIDOWED'] as const;
const ORIGINAL_VALUES = ['SINGLE', 'MARRIED', 'DIVORCED'] as const;

/**
 * Story 210 — estado civil ganha "União estável" (`STABLE_UNION`) e
 * "Viúvo(a)" (`WIDOWED`) para filhos e servos.
 *
 * `up`: `ALTER TYPE ... ADD VALUE IF NOT EXISTS` nos dois enums. O PostgreSQL
 * (>= 12) aceita isso dentro da transação da migration, desde que o valor
 * novo não seja USADO na mesma transação — e esta migration só cria os
 * valores, não grava nem compara nada com eles. Por isso ela roda na
 * transação padrão do TypeORM, sem `transaction = false`.
 *
 * `down`: o PostgreSQL não remove valor de enum. O tipo é recriado sem os
 * valores novos, depois de mover para `NULL` toda linha que os usava.
 * ATENÇÃO: o `down` PERDE esse dado — quem estava como "União estável" ou
 * "Viúvo(a)" volta sem estado civil. As comparações usam `::text` para não
 * depender do valor de enum (que some no meio do processo).
 */
export class AddStableUnionAndWidowedToMaritalStatus1783038000000 implements MigrationInterface {
  name = 'AddStableUnionAndWidowedToMaritalStatus1783038000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const { type } of ENUM_TABLES) {
      for (const value of NEW_VALUES) {
        await queryRunner.query(`ALTER TYPE public.${type} ADD VALUE IF NOT EXISTS '${value}'`);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const newValues = NEW_VALUES.map((v) => `'${v}'`).join(', ');
    const originalValues = ORIGINAL_VALUES.map((v) => `'${v}'`).join(', ');

    for (const { type, table } of ENUM_TABLES) {
      // Perda de dado intencional (ver doc da classe).
      await queryRunner.query(
        `UPDATE public.${table} SET marital_status = NULL WHERE marital_status::text IN (${newValues})`,
      );
      await queryRunner.query(`ALTER TYPE public.${type} RENAME TO ${type}_old`);
      await queryRunner.query(`CREATE TYPE public.${type} AS ENUM (${originalValues})`);
      await queryRunner.query(
        `ALTER TABLE public.${table} ALTER COLUMN marital_status TYPE public.${type} ` +
          `USING marital_status::text::public.${type}`,
      );
      await queryRunner.query(`DROP TYPE public.${type}_old`);
    }
  }
}
