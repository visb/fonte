import {
  BadRequestException,
  Controller,
  Get,
  Post,
  UseGuards,
} from "@nestjs/common";
import { Role } from "@fonte/types";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { BackupService, BackupSummary } from "./backup.service";

@Controller("backup")
@UseGuards(JwtAuthGuard, RolesGuard)
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Get()
  @Roles(Role.ADMIN)
  list() {
    return this.backupService.listBackups();
  }

  @Post("run")
  @Roles(Role.ADMIN)
  async run(): Promise<BackupSummary> {
    if (!this.backupService.isConfigured()) {
      throw new BadRequestException(
        "Backup não configurado (defina BACKUP_S3_BUCKET_NAME e AWS_ENDPOINT_URL).",
      );
    }
    return this.backupService.runBackup();
  }
}
