import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { Role } from '@fonte/types';
import { NotificationService, NotificationUser } from './notification.service';
import { ListNotificationsDto } from './dto/list-notifications.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationController {
  constructor(private readonly service: NotificationService) {}

  @Get()
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.SERVANT)
  list(@CurrentUser() user: AuthenticatedUser, @Query() dto: ListNotificationsDto) {
    return this.service.listForUser(this.toNotificationUser(user), {
      unreadOnly: dto.unreadOnly === 'true',
      page: dto.page,
    });
  }

  @Get('unread-count')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.SERVANT)
  async unreadCount(@CurrentUser() user: AuthenticatedUser) {
    const count = await this.service.unreadCount(this.toNotificationUser(user));
    return { count };
  }

  @Patch(':id/read')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.SERVANT)
  async markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.service.markRead(id, this.toNotificationUser(user));
    return { success: true };
  }

  @Patch('read-all')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.SERVANT)
  async markAllRead(@CurrentUser() user: AuthenticatedUser) {
    await this.service.markAllRead(this.toNotificationUser(user));
    return { success: true };
  }

  private toNotificationUser(user: AuthenticatedUser): NotificationUser {
    return { userId: user.userId, role: user.role as Role };
  }
}
