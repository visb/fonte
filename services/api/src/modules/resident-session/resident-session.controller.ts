import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@fonte/types';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { HeartbeatDto } from './dto/heartbeat.dto';
import { ResidentSessionService } from './resident-session.service';

@Controller('resident-sessions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ResidentSessionController {
  constructor(private service: ResidentSessionService) {}

  @Get('today')
  @Roles(Role.RESIDENT)
  getToday(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getTodayByUserId(user.userId);
  }

  @Post('heartbeat')
  @Roles(Role.RESIDENT)
  heartbeat(@CurrentUser() user: AuthenticatedUser, @Body() dto: HeartbeatDto) {
    return this.service.addSeconds(user.userId, dto.seconds);
  }

  @Post(':residentId/reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.ADMIN, Role.COORDINATOR)
  reset(@Param('residentId', ParseUUIDPipe) residentId: string) {
    return this.service.reset(residentId);
  }
}
