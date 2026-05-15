import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
import { AddWishlistItemDto } from './dto/add-wishlist-item.dto';
import { RejectWishlistItemDto } from './dto/reject-wishlist-item.dto';
import { WishlistService } from './wishlist.service';

@Controller('wishlist')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WishlistController {
  constructor(private service: WishlistService) {}

  @Get('pending')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR)
  getPending(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findPending(user.userId);
  }

  @Get(':residentId')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR, Role.RESIDENT, Role.RELATIVE)
  getItems(
    @CurrentUser() user: AuthenticatedUser,
    @Param('residentId', ParseUUIDPipe) residentId: string,
  ) {
    return this.service.findAllForCaller(user.userId, user.role, residentId);
  }

  @Post(':residentId/items')
  @Roles(Role.RESIDENT)
  addItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('residentId', ParseUUIDPipe) residentId: string,
    @Body() dto: AddWishlistItemDto,
  ) {
    return this.service.addItem(user.userId, residentId, dto);
  }

  @Delete(':residentId/items/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.RESIDENT)
  removeItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('residentId', ParseUUIDPipe) residentId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.service.requestRemoval(user.userId, residentId, itemId);
  }

  @Patch('items/:itemId/approve')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR)
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.service.approve(user.userId, itemId);
  }

  @Patch('items/:itemId/reject')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR)
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: RejectWishlistItemDto,
  ) {
    return this.service.reject(user.userId, itemId, dto.reason);
  }
}
