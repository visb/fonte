import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { Role } from '@fonte/types';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { OfflineSnapshotQueryDto } from './dto/offline-snapshot-query.dto';
import { HouseSnapshot, OfflineSyncService } from './offline-sync.service';

/**
 * Pacote offline da casa (story 177).
 *
 * `RELATIVE` e `RESIDENT` não entram: o snapshot é a ficha completa de todos os
 * filhos da casa e existe para o `ops.fonte`. O recorte por casa (staff só vê a
 * própria) fica no service, junto do dado que decide.
 */
@Controller('houses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OfflineSyncController {
  constructor(private readonly service: OfflineSyncService) {}

  @Get(':houseId/offline-snapshot')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.SERVANT)
  houseSnapshot(
    @Param('houseId', ParseUUIDPipe) houseId: string,
    @Query() query: OfflineSnapshotQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<HouseSnapshot> {
    return this.service.houseSnapshot(houseId, query, user);
  }
}
