import { Controller, HttpCode, HttpStatus, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@fonte/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ReconcileStorageDto } from './dto/reconcile-storage.dto';
import {
  StorageReconcileReport,
  StorageReconcileService,
} from './storage-reconcile.service';

@Controller('storage')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class StorageController {
  constructor(private readonly reconcileService: StorageReconcileService) {}

  /**
   * Reconciliação one-shot dos órfãos no bucket (story 93). Dry-run por padrão
   * (`?apply=false`): só relata os órfãos. `?apply=true` apaga (best-effort).
   * Restrito a ADMIN.
   */
  @Post('reconcile')
  @HttpCode(HttpStatus.OK)
  reconcile(@Query() query: ReconcileStorageDto): Promise<StorageReconcileReport> {
    return this.reconcileService.reconcile(query.apply ?? false);
  }
}
