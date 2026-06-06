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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { CreateCapacityRequestDto } from './dto/create-capacity-request.dto';
import { HouseCapacityRequestService } from './house-capacity-request.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class HouseCapacityRequestController {
  constructor(private readonly service: HouseCapacityRequestService) {}

  @Post('houses/:id/capacity-requests')
  @Roles(Role.COORDINATOR)
  create(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCapacityRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.createRequest(id, dto, user.userId);
  }

  @Get('houses/:id/capacity-requests')
  @Roles(Role.ADMIN)
  list(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.listForHouse(id);
  }

  @Get('house-capacity-requests/:requestId')
  @Roles(Role.ADMIN)
  getOne(@Param('requestId', ParseUUIDPipe) requestId: string) {
    return this.service.getById(requestId);
  }

  @Patch('house-capacity-requests/:requestId/approve')
  @Roles(Role.ADMIN)
  approve(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.approve(requestId, user.userId);
  }

  @Patch('house-capacity-requests/:requestId/reject')
  @Roles(Role.ADMIN)
  reject(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.reject(requestId, user.userId);
  }
}
