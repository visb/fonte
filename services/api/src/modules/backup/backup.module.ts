import { Module } from "@nestjs/common";
import { BackupController } from "./backup.controller";
import { BackupService } from "./backup.service";
import { BackupScheduler } from "./backup.scheduler";

@Module({
  controllers: [BackupController],
  providers: [BackupService, BackupScheduler],
  exports: [BackupService],
})
export class BackupModule {}
