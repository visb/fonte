import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { Role } from '@fonte/types';
import { ActivityCommentService } from './activity-comment.service';
import { CreateActivityCommentDto } from './dto/create-activity-comment.dto';

@Controller('activities/:activityId/comments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.COORDINATOR, Role.SERVANT)
export class ActivityCommentController {
  constructor(private service: ActivityCommentService) {}

  @Get()
  findAll(
    @Param('activityId', ParseUUIDPipe) activityId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findAll(activityId, user);
  }

  @Post()
  create(
    @Param('activityId', ParseUUIDPipe) activityId: string,
    @Body() dto: CreateActivityCommentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.create(activityId, dto, user);
  }

  @Delete(':commentId')
  @HttpCode(204)
  remove(
    @Param('activityId', ParseUUIDPipe) activityId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.remove(activityId, commentId, user);
  }
}
