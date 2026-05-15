import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { Role } from '@fonte/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AppSettingsService } from './app-settings.service';
import { UpdateAppSettingsDto } from './dto/update-app-settings.dto';

@Controller('app-settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AppSettingsController {
  constructor(private service: AppSettingsService) {}

  @Get()
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR)
  get() {
    return this.service.get();
  }

  @Patch()
  @Roles(Role.ADMIN)
  update(@Body() dto: UpdateAppSettingsDto) {
    return this.service.update(dto);
  }
}
