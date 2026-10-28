import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApplyDailyResult, DailyBoard, MoveDailyPersonResult, Role } from '@fonte/types';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { DailyService } from './daily.service';
import { DailyHouseDto } from './dto/daily-house.dto';
import { MoveDailyPersonDto } from './dto/move-daily-person.dto';

/** Story 225 — Daily (board de ministérios). Só ADMIN e COORDINATOR (decisão 3). */
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.COORDINATOR)
export class DailyController {
  constructor(private readonly service: DailyService) {}

  @Get('daily/current')
  current(@Query() query: DailyHouseDto, @CurrentUser() user: AuthenticatedUser): Promise<DailyBoard> {
    return this.service.current(user, query.houseId);
  }

  @Post('daily')
  start(@Body() dto: DailyHouseDto, @CurrentUser() user: AuthenticatedUser): Promise<DailyBoard> {
    return this.service.start(user, dto.houseId);
  }

  @Post('daily-sessions/:id/moves')
  @HttpCode(HttpStatus.OK)
  move(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MoveDailyPersonDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MoveDailyPersonResult> {
    return this.service.move(user, id, dto);
  }

  @Post('daily-sessions/:id/apply')
  @HttpCode(HttpStatus.OK)
  apply(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApplyDailyResult> {
    return this.service.apply(user, id);
  }
}
