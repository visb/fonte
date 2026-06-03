import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenameOperatorToServant1780900000000 implements MigrationInterface {
  name = 'RenameOperatorToServant1780900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // OPERATOR passa a se chamar SERVANT. RENAME VALUE renomeia in-place:
    // todas as linhas gravadas como 'OPERATOR' passam a ler 'SERVANT'.
    await queryRunner.query(
      `ALTER TYPE "public"."users_role_enum" RENAME VALUE 'OPERATOR' TO 'SERVANT'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."users_role_enum" RENAME VALUE 'SERVANT' TO 'OPERATOR'`,
    );
  }
}
