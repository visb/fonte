import { MigrationInterface, QueryRunner } from 'typeorm';

export class Associates1782500000000 implements MigrationInterface {
  name = 'Associates1782500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."associates_status_enum" AS ENUM('PENDING', 'ACTIVE', 'PAST_DUE', 'CANCELED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."associate_subscriptions_status_enum" AS ENUM('ACTIVE', 'PAST_DUE', 'CANCELED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."associate_charges_status_enum" AS ENUM('PENDING', 'PAID', 'FAILED')`,
    );

    await queryRunner.query(`
      CREATE TABLE "associates" (
        "id"                       UUID                                  NOT NULL DEFAULT uuid_generate_v4(),
        "name"                     VARCHAR                               NOT NULL,
        "whatsapp"                 VARCHAR                               NOT NULL,
        "email"                    VARCHAR,
        "contribution_amount"      NUMERIC(10,2)                         NOT NULL,
        "due_day"                  SMALLINT                              NOT NULL,
        "status"                   "public"."associates_status_enum"     NOT NULL DEFAULT 'PENDING',
        "abacatepay_customer_id"   VARCHAR,
        "payment_token"            UUID                                  NOT NULL DEFAULT uuid_generate_v4(),
        "created_at"               TIMESTAMP                             NOT NULL DEFAULT now(),
        "updated_at"               TIMESTAMP                             NOT NULL DEFAULT now(),
        "deleted_at"               TIMESTAMP,
        CONSTRAINT "PK_associates" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_associates_payment_token" UNIQUE ("payment_token")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "associate_subscriptions" (
        "id"                          UUID                                              NOT NULL DEFAULT uuid_generate_v4(),
        "associate_id"                UUID                                              NOT NULL,
        "abacatepay_subscription_id"  VARCHAR,
        "net_amount"                  NUMERIC(10,2)                                     NOT NULL,
        "fee_amount"                  NUMERIC(10,2)                                     NOT NULL,
        "gross_amount"                NUMERIC(10,2)                                     NOT NULL,
        "status"                      "public"."associate_subscriptions_status_enum"    NOT NULL DEFAULT 'ACTIVE',
        "started_at"                  TIMESTAMP,
        "canceled_at"                 TIMESTAMP,
        "created_at"                  TIMESTAMP                                         NOT NULL DEFAULT now(),
        "updated_at"                  TIMESTAMP                                         NOT NULL DEFAULT now(),
        CONSTRAINT "PK_associate_subscriptions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_associate_subscriptions_associate" FOREIGN KEY ("associate_id") REFERENCES "associates"("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "associate_charges" (
        "id"                     UUID                                          NOT NULL DEFAULT uuid_generate_v4(),
        "associate_id"           UUID                                          NOT NULL,
        "subscription_id"        UUID,
        "abacatepay_charge_id"   VARCHAR,
        "net_amount"             NUMERIC(10,2)                                 NOT NULL,
        "fee_amount"             NUMERIC(10,2)                                 NOT NULL,
        "gross_amount"           NUMERIC(10,2)                                 NOT NULL,
        "status"                 "public"."associate_charges_status_enum"      NOT NULL DEFAULT 'PENDING',
        "due_date"               DATE                                          NOT NULL,
        "paid_at"                TIMESTAMP,
        "created_at"             TIMESTAMP                                     NOT NULL DEFAULT now(),
        "updated_at"             TIMESTAMP                                     NOT NULL DEFAULT now(),
        CONSTRAINT "PK_associate_charges" PRIMARY KEY ("id"),
        CONSTRAINT "FK_associate_charges_associate"    FOREIGN KEY ("associate_id")    REFERENCES "associates"("id"),
        CONSTRAINT "FK_associate_charges_subscription" FOREIGN KEY ("subscription_id") REFERENCES "associate_subscriptions"("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "associate_charge_notifications" (
        "id"             UUID        NOT NULL DEFAULT uuid_generate_v4(),
        "associate_id"   UUID        NOT NULL,
        "channel"        VARCHAR     NOT NULL,
        "type"           VARCHAR     NOT NULL,
        "sent_at"        TIMESTAMP   NOT NULL,
        "created_at"     TIMESTAMP   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_associate_charge_notifications" PRIMARY KEY ("id"),
        CONSTRAINT "FK_associate_charge_notifications_associate" FOREIGN KEY ("associate_id") REFERENCES "associates"("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "associate_charge_notifications"`);
    await queryRunner.query(`DROP TABLE "associate_charges"`);
    await queryRunner.query(`DROP TABLE "associate_subscriptions"`);
    await queryRunner.query(`DROP TABLE "associates"`);
    await queryRunner.query(`DROP TYPE "public"."associate_charges_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."associate_subscriptions_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."associates_status_enum"`);
  }
}
