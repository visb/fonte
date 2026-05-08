import { MigrationInterface, QueryRunner } from 'typeorm';

export class StoreroomWeeklyAverageUsage1779200000000 implements MigrationInterface {
  name = 'StoreroomWeeklyAverageUsage1779200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "storeroom_items"
        ADD "weekly_average_usage" numeric(10,3) NOT NULL DEFAULT 0,
        ADD "weekly_average_calculated_at" TIMESTAMP,
        ADD "weekly_average_window_start" date,
        ADD "weekly_average_window_end" date,
        ADD CONSTRAINT "CHK_storeroom_items_weekly_average_usage_non_negative"
          CHECK ("weekly_average_usage" >= 0)
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_storeroom_movements_type_date_item"
        ON "storeroom_movements" ("type", "date", "item_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_storeroom_movements_type_date_item"`);
    await queryRunner.query(`
      ALTER TABLE "storeroom_items"
        DROP CONSTRAINT "CHK_storeroom_items_weekly_average_usage_non_negative",
        DROP COLUMN "weekly_average_window_end",
        DROP COLUMN "weekly_average_window_start",
        DROP COLUMN "weekly_average_calculated_at",
        DROP COLUMN "weekly_average_usage"
    `);
  }
}
