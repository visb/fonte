import { MigrationInterface, QueryRunner } from 'typeorm';

export class FamilyInvestmentEnum1780002000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // Nullify existing free-text values (cannot map to enum)
    await queryRunner.query(`
      UPDATE residents SET family_investment = NULL WHERE family_investment IS NOT NULL
    `);
    await queryRunner.query(`
      UPDATE admissions SET family_investment = NULL WHERE family_investment IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TYPE "family_investment_enum" AS ENUM
        ('BASKET_500', 'PAYMENT_700', 'SOCIAL', 'NEGOTIATED')
    `);

    await queryRunner.query(`
      ALTER TABLE residents
        ALTER COLUMN family_investment TYPE "family_investment_enum"
          USING family_investment::"family_investment_enum",
        ADD COLUMN family_investment_amount integer NULL
    `);

    await queryRunner.query(`
      ALTER TABLE admissions
        ALTER COLUMN family_investment TYPE "family_investment_enum"
          USING family_investment::"family_investment_enum",
        ADD COLUMN family_investment_amount integer NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE residents
        ALTER COLUMN family_investment TYPE varchar
          USING family_investment::varchar,
        DROP COLUMN family_investment_amount
    `);
    await queryRunner.query(`
      ALTER TABLE admissions
        ALTER COLUMN family_investment TYPE varchar
          USING family_investment::varchar,
        DROP COLUMN family_investment_amount
    `);
    await queryRunner.query(`DROP TYPE IF EXISTS "family_investment_enum"`);
  }
}
