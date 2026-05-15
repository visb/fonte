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
import { SupportGroupService } from './support-group.service';
import { CreateSupportGroupDto } from './dto/create-support-group.dto';
import { UpdateSupportGroupDto } from './dto/update-support-group.dto';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { AddCheckinDto } from './dto/add-checkin.dto';
import { AddRelativeCheckinDto } from './dto/add-relative-checkin.dto';

@Controller('support-groups')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SupportGroupController {
  constructor(private service: SupportGroupService) {}

  // ─── Groups ──────────────────────────────────────────────────────────────────

  @Get()
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR)
  findAll() {
    return this.service.findAll();
  }

  @Post()
  @Roles(Role.ADMIN, Role.COORDINATOR)
  create(@Body() dto: CreateSupportGroupDto) {
    return this.service.create(dto);
  }

  @Get('meetings')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR)
  findAllMeetings() {
    return this.service.findAllMeetings();
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupportGroupDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.ADMIN, Role.COORDINATOR)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.remove(id);
  }

  // ─── Meetings ─────────────────────────────────────────────────────────────────

  @Get(':id/meetings')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR)
  findMeetings(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findMeetings(id);
  }

  @Post(':id/meetings')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR)
  createMeeting(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateMeetingDto,
  ) {
    return this.service.createMeeting(id, dto);
  }

  @Get('meetings/:meetingId')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR)
  findMeetingDetail(@Param('meetingId', ParseUUIDPipe) meetingId: string) {
    return this.service.findMeetingDetail(meetingId);
  }

  @Get('meetings/:meetingId/relative-checkins')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR)
  findMeetingRelativeCheckins(@Param('meetingId', ParseUUIDPipe) meetingId: string) {
    return this.service.findMeetingRelativeCheckins(meetingId);
  }

  @Get('relatives/:relativeId/checkin-history')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR)
  findRelativeCheckinHistory(@Param('relativeId', ParseUUIDPipe) relativeId: string) {
    return this.service.findRelativeCheckinHistory(relativeId);
  }

  @Get('residents/:residentId/checkin-history')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR)
  findResidentCheckinHistory(@Param('residentId', ParseUUIDPipe) residentId: string) {
    return this.service.findResidentCheckinHistory(residentId);
  }

  // ─── Checkins ─────────────────────────────────────────────────────────────────

  @Post('meetings/:meetingId/checkins')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR)
  addCheckin(
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
    @Body() dto: AddCheckinDto,
  ) {
    return this.service.addCheckin(meetingId, dto.residentId);
  }

  @Delete('meetings/:meetingId/checkins/:checkinId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR)
  removeCheckin(
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
    @Param('checkinId', ParseUUIDPipe) checkinId: string,
  ): Promise<void> {
    return this.service.removeCheckin(meetingId, checkinId);
  }

  @Post('relative-checkin')
  @Roles(Role.RELATIVE)
  addRelativeCheckin(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddRelativeCheckinDto,
  ) {
    return this.service.addRelativeCheckin(user.userId, dto.token);
  }
}
