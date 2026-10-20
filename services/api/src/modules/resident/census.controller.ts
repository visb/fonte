import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@fonte/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { Idempotent } from '../../common/decorators/idempotent.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { CreateResidentDto } from './dto/create-resident.dto';
import { ConcludeCensusDto } from './dto/conclude-census.dto';
import { CensusService } from './census.service';

@Controller('census')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CensusController {
  constructor(private readonly service: CensusService) {}

  // Story 214: ADMIN lotado na casa também é coordenador dela.
  @Post('residents')
  @Roles(Role.COORDINATOR, Role.ADMIN)
  @Idempotent()
  addResident(
    @Body() dto: CreateResidentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.addResident(dto, user.userId);
  }

  @Post('conclude')
  @Roles(Role.COORDINATOR, Role.ADMIN)
  @Idempotent()
  conclude(
    @Body() dto: ConcludeCensusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.conclude(dto, user.userId);
  }

  @Get('houses/:houseId/pending')
  @Roles(Role.ADMIN)
  listPending(@Param('houseId', ParseUUIDPipe) houseId: string) {
    return this.service.listPending(houseId);
  }

  @Post('houses/:houseId/approve-all')
  @Roles(Role.ADMIN)
  approveAll(@Param('houseId', ParseUUIDPipe) houseId: string) {
    return this.service.approveAll(houseId);
  }

  @Patch('residents/:id/reject')
  @Roles(Role.ADMIN)
  reject(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.reject(id);
  }
}
