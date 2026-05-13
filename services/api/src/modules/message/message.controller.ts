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
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SendMessageDto } from './dto/send-message.dto';
import { MessageService } from './message.service';

@Controller('messages')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MessageController {
  constructor(private service: MessageService) {}

  @Get('conversations')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR)
  getConversations(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getConversations(user.userId);
  }

  @Get('my-conversations')
  @Roles(Role.RESIDENT)
  getMyConversations(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getMyConversations(user.userId);
  }

  @Get('conversations/:residentId/:relativeId')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR, Role.RESIDENT)
  getThread(
    @CurrentUser() user: AuthenticatedUser,
    @Param('residentId', ParseUUIDPipe) residentId: string,
    @Param('relativeId', ParseUUIDPipe) relativeId: string,
  ) {
    return this.service.getThread(user.userId, user.role, residentId, relativeId);
  }

  @Get('pending')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR)
  getPending(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getPending(user.userId);
  }

  @Post()
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR, Role.RESIDENT)
  send(@CurrentUser() user: AuthenticatedUser, @Body() dto: SendMessageDto) {
    return this.service.send(user.userId, user.profileType, dto);
  }

  @Patch(':id/approve')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR)
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.approve(user.userId, id);
  }

  @Patch(':id/reject')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR)
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.reject(user.userId, id);
  }
}
