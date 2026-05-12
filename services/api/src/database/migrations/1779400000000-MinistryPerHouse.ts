import { MigrationInterface, QueryRunner } from 'typeorm';

export class MinistryPerHouse1779400000000 implements MigrationInterface {
  name = 'MinistryPerHouse1779400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add new columns to ministries
    await queryRunner.query(`
      ALTER TABLE "ministries"
        ADD COLUMN "house_id"    uuid,
        ADD COLUMN "leader_id"   uuid,
        ADD COLUMN "leader_type" VARCHAR(10)
    `);

    // 2. For each house_ministry: update the ministry with house/leader info.
    //    If multiple houses share the same global ministry, clone it for each extra house.
    await queryRunner.query(`
      DO $$
      DECLARE
        hm RECORD;
        existing_house_id uuid;
        new_ministry_id uuid;
      BEGIN
        FOR hm IN
          SELECT j.id, j.house_id, j.ministry_id, j.leader_id, j.leader_type,
                 m.name AS ministry_name
          FROM house_ministries j
          JOIN ministries m ON m.id = j.ministry_id
          ORDER BY j.created_at
        LOOP
          -- Check if this ministry already has a house_id assigned
          SELECT house_id INTO existing_house_id
          FROM ministries
          WHERE id = hm.ministry_id;

          IF existing_house_id IS NULL THEN
            -- First house to claim this ministry: update in place
            UPDATE ministries
            SET house_id    = hm.house_id,
                leader_id   = hm.leader_id,
                leader_type = hm.leader_type
            WHERE id = hm.ministry_id;
          ELSE
            -- Ministry already claimed by another house: create a copy
            INSERT INTO ministries (id, name, house_id, leader_id, leader_type, created_at, updated_at)
            VALUES (uuid_generate_v4(), hm.ministry_name, hm.house_id, hm.leader_id, hm.leader_type, now(), now())
            RETURNING id INTO new_ministry_id;

            -- Redirect residents from this house to the new ministry copy
            UPDATE residents
            SET ministry_id = new_ministry_id
            WHERE ministry_id = hm.ministry_id
              AND house_id    = hm.house_id;
          END IF;
        END LOOP;
      END;
      $$
    `);

    // 3. Delete global ministries that were never assigned to any house
    await queryRunner.query(`
      DELETE FROM ministries WHERE house_id IS NULL
    `);

    // 4. Make house_id NOT NULL and add FK
    await queryRunner.query(`
      ALTER TABLE "ministries"
        ALTER COLUMN "house_id" SET NOT NULL,
        ADD CONSTRAINT "FK_ministries_house"
          FOREIGN KEY ("house_id") REFERENCES "houses"("id") ON DELETE CASCADE
    `);

    // 5. Create ministry_staff junction table
    await queryRunner.query(`
      CREATE TABLE "ministry_staff" (
        "id"          uuid      NOT NULL DEFAULT uuid_generate_v4(),
        "ministry_id" uuid      NOT NULL,
        "staff_id"    uuid      NOT NULL,
        "created_at"  TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"  TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ministry_staff" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_ministry_staff" UNIQUE ("ministry_id", "staff_id"),
        CONSTRAINT "FK_ministry_staff_ministry"
          FOREIGN KEY ("ministry_id") REFERENCES "ministries"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_ministry_staff_staff"
          FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE CASCADE
      )
    `);

    // 6. Create ministry_tasks table
    await queryRunner.query(`
      CREATE TABLE "ministry_tasks" (
        "id"           uuid      NOT NULL DEFAULT uuid_generate_v4(),
        "ministry_id"  uuid      NOT NULL,
        "title"        varchar   NOT NULL,
        "completed"    boolean   NOT NULL DEFAULT false,
        "repetition"   varchar(10) NOT NULL DEFAULT 'NONE',
        "completed_at" TIMESTAMPTZ,
        "created_at"   TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"   TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at"   TIMESTAMP,
        CONSTRAINT "PK_ministry_tasks" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ministry_tasks_ministry"
          FOREIGN KEY ("ministry_id") REFERENCES "ministries"("id") ON DELETE CASCADE
      )
    `);

    // 7. Drop the house_ministries junction table
    await queryRunner.query(`DROP TABLE "house_ministries"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "ministry_tasks"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ministry_staff"`);

    await queryRunner.query(`
      CREATE TABLE "house_ministries" (
        "id"          uuid      NOT NULL DEFAULT uuid_generate_v4(),
        "house_id"    uuid      NOT NULL,
        "ministry_id" uuid      NOT NULL,
        "leader_id"   uuid,
        "leader_type" VARCHAR(10),
        "created_at"  TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"  TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_house_ministries" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_house_ministries_house_ministry" UNIQUE ("house_id", "ministry_id"),
        CONSTRAINT "FK_house_ministries_house"
          FOREIGN KEY ("house_id") REFERENCES "houses"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_house_ministries_ministry"
          FOREIGN KEY ("ministry_id") REFERENCES "ministries"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "ministries"
        DROP CONSTRAINT IF EXISTS "FK_ministries_house",
        DROP COLUMN IF EXISTS "house_id",
        DROP COLUMN IF EXISTS "leader_id",
        DROP COLUMN IF EXISTS "leader_type"
    `);
  }
}
