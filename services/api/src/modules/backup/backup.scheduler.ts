import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { BackupService } from "./backup.service";

@Injectable()
export class BackupScheduler {
  private readonly logger = new Logger(BackupScheduler.name);

  constructor(private readonly backupService: BackupService) {}

  // Domingos às 04:00 (America/Sao_Paulo), fora dos horários dos outros jobs
  // (08:00 notificações, sáb 02:00 storeroom).
  @Cron("0 0 4 * * 0", {
    name: "weekly-backup",
    timeZone: "America/Sao_Paulo",
  })
  async weeklyBackup() {
    if (!this.backupService.isEnabled()) {
      this.logger.log("Backup automático desabilitado (BACKUP_ENABLED != true)");
      return;
    }

    this.logger.log("Iniciando backup semanal");
    try {
      const result = await this.backupService.runBackup();
      if (result.skipped) {
        this.logger.log(`Backup semanal pulado: ${result.reason}`);
        return;
      }
      this.logger.log(
        `Backup semanal finalizado: dump ${result.dumpKey}, ${result.filesCopied}/${result.filesTotal} arquivos, ${result.prunedDumps?.length ?? 0} dumps removidos`,
      );
    } catch (error) {
      this.logger.error(
        "Falha no backup semanal",
        error instanceof Error ? error.stack : error,
      );
      throw error;
    }
  }
}
