import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1777743139019 implements MigrationInterface {
    name = 'InitialSchema1777743139019'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('ADMIN', 'COORDINATOR', 'OPERATOR', 'RELATIVE', 'RESIDENT')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "password_hash" character varying NOT NULL, "role" "public"."users_role_enum" NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "storerooms" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "PK_631e502e494d666739c0c7c75f2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "houses" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "PK_ee6cacb502a4b8590005eb3dc8d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."residents_status_enum" AS ENUM('PRE_ADMISSION', 'ACTIVE', 'DISCIPLINE', 'TEMP_LEAVE', 'DISCHARGED', 'EVADED')`);
        await queryRunner.query(`CREATE TABLE "residents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "birth_date" date, "cpf" character varying, "status" "public"."residents_status_enum" NOT NULL DEFAULT 'PRE_ADMISSION', "user_id" uuid, "house_id" uuid NOT NULL, "entry_date" date, "exit_date" date, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "REL_e7e6da6e7bccd71a8c7d65469c" UNIQUE ("user_id"), CONSTRAINT "PK_4c8d0413ee0e9a4ebbf500f7365" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "routine_entries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "PK_b351ba7f50d3e952051e97c4082" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "staff" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "phone" character varying, "user_id" uuid NOT NULL, "house_id" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "REL_cec9365d9fc3a3409158b645f2" UNIQUE ("user_id"), CONSTRAINT "PK_e4ee98bb552756c180aec1e854a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "ministries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "PK_ad897fa0432df1de62b552a8706" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "relatives" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "phone" character varying, "relationship" character varying, "user_id" uuid, "resident_id" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "REL_4cbde7eae8b44b16095dade8ed" UNIQUE ("user_id"), CONSTRAINT "PK_4c16d30b6af847a1f7286caf2c3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "incidents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "PK_ccb34c01719889017e2246469f9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "residents" ADD CONSTRAINT "FK_e7e6da6e7bccd71a8c7d65469cc" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "residents" ADD CONSTRAINT "FK_72d68158de1f2018938e9603005" FOREIGN KEY ("house_id") REFERENCES "houses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "staff" ADD CONSTRAINT "FK_cec9365d9fc3a3409158b645f2e" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "staff" ADD CONSTRAINT "FK_d5c355c41739991f9ebda9b87b2" FOREIGN KEY ("house_id") REFERENCES "houses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "relatives" ADD CONSTRAINT "FK_4cbde7eae8b44b16095dade8ed9" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "relatives" ADD CONSTRAINT "FK_50ba8691dfc920a91f159f385a0" FOREIGN KEY ("resident_id") REFERENCES "residents"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "relatives" DROP CONSTRAINT "FK_50ba8691dfc920a91f159f385a0"`);
        await queryRunner.query(`ALTER TABLE "relatives" DROP CONSTRAINT "FK_4cbde7eae8b44b16095dade8ed9"`);
        await queryRunner.query(`ALTER TABLE "staff" DROP CONSTRAINT "FK_d5c355c41739991f9ebda9b87b2"`);
        await queryRunner.query(`ALTER TABLE "staff" DROP CONSTRAINT "FK_cec9365d9fc3a3409158b645f2e"`);
        await queryRunner.query(`ALTER TABLE "residents" DROP CONSTRAINT "FK_72d68158de1f2018938e9603005"`);
        await queryRunner.query(`ALTER TABLE "residents" DROP CONSTRAINT "FK_e7e6da6e7bccd71a8c7d65469cc"`);
        await queryRunner.query(`DROP TABLE "incidents"`);
        await queryRunner.query(`DROP TABLE "relatives"`);
        await queryRunner.query(`DROP TABLE "ministries"`);
        await queryRunner.query(`DROP TABLE "staff"`);
        await queryRunner.query(`DROP TABLE "routine_entries"`);
        await queryRunner.query(`DROP TABLE "residents"`);
        await queryRunner.query(`DROP TYPE "public"."residents_status_enum"`);
        await queryRunner.query(`DROP TABLE "houses"`);
        await queryRunner.query(`DROP TABLE "storerooms"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    }

}
