import { MigrationInterface, QueryRunner } from 'typeorm';

export class HouseCapacityRequests1781600000000 implements MigrationInterface {
  name = 'HouseCapacityRequests1781600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Novos tipos de notificação para o fluxo de aprovação de capacidade.
    await queryRunner.query(
      `ALTER TYPE "notification_type_enum" ADD VALUE IF NOT EXISTS 'CAPACITY_CHANGE_REQUESTED'`,
    );
    await queryRunner.query(
      `ALTER TYPE "notification_type_enum" ADD VALUE IF NOT EXISTS 'CAPACITY_CHANGE_APPROVED'`,
    );
    await queryRunner.query(
      `ALTER TYPE "notification_type_enum" ADD VALUE IF NOT EXISTS 'CAPACITY_CHANGE_REJECTED'`,
    );

    await queryRunner.query(`
      CREATE TYPE "house_capacity_request_status_enum" AS ENUM (
        'PENDING',
        'APPROVED',
        'REJECTED',
        'SUPERSEDED'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "house_capacity_requests" (
        "id"                          uuid        NOT NULL DEFAULT uuid_generate_v4(),
        "house_id"                    uuid        NOT NULL,
        "requested_general_capacity"  integer     NOT NULL,
        "requested_staff_capacity"    integer     NOT NULL,
        "previous_general_capacity"   integer     NULL,
        "previous_staff_capacity"     integer     NULL,
        "status"                      "house_capacity_request_status_enum" NOT NULL DEFAULT 'PENDING',
        "requested_by_id"             uuid        NOT NULL,
        "reviewed_by_id"              uuid        NULL,
        "reviewed_at"                 TIMESTAMPTZ NULL,
        "created_at"                  TIMESTAMP   NOT NULL DEFAULT now(),
        "updated_at"                  TIMESTAMP   NOT NULL DEFAULT now(),
        "deleted_at"                  TIMESTAMP   NULL,
        CONSTRAINT "PK_house_capacity_requests" PRIMARY KEY ("id"),
        CONSTRAINT "FK_house_capacity_requests_house"
          FOREIGN KEY ("house_id") REFERENCES "houses"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_house_capacity_requests_requested_by"
          FOREIGN KEY ("requested_by_id") REFERENCES "staff"("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_house_capacity_requests_house_id"
        ON "house_capacity_requests" ("house_id")
    `);
    // Garante no máximo um pedido PENDING por casa (novo pedido supersede o anterior).
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_house_capacity_requests_pending_per_house"
        ON "house_capacity_requests" ("house_id")
        WHERE "status" = 'PENDING' AND "deleted_at" IS NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_house_capacity_requests_pending_per_house"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_house_capacity_requests_house_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "house_capacity_requests"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "house_capacity_request_status_enum"`);
    // Os valores adicionados ao notification_type_enum não são removidos
    // (Postgres não suporta remover valor de enum sem recriar o tipo).
  }
}
