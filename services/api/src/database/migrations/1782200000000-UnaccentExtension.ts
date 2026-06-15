import { MigrationInterface, QueryRunner } from 'typeorm';

// Habilita a extensão `unaccent` para busca de nomes insensível a acento
// (ex: buscar "joao" encontra "João"). Contrib padrão do Postgres.
export class UnaccentExtension1782200000000 implements MigrationInterface {
  name = 'UnaccentExtension1782200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS unaccent`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP EXTENSION IF EXISTS unaccent`);
  }
}
