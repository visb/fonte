import { MigrationInterface, QueryRunner } from 'typeorm';

export class AuditLogs1781800000000 implements MigrationInterface {
  name = 'AuditLogs1781800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id"          UUID        NOT NULL DEFAULT uuid_generate_v4(),
        "user_id"     UUID        NULL,
        "role"        VARCHAR     NULL,
        "action"      VARCHAR     NOT NULL,
        "target_type" VARCHAR     NULL,
        "target_id"   VARCHAR     NULL,
        "http_method" VARCHAR     NULL,
        "path"        VARCHAR     NULL,
        "ip_address"  VARCHAR     NULL,
        "created_at"  TIMESTAMP   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_logs" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_user_id" ON "audit_logs" ("user_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_action" ON "audit_logs" ("action")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_target_id" ON "audit_logs" ("target_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "audit_logs"`);
  }
}
