import { Controller, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('staff')
@UseGuards(JwtAuthGuard)
export class StaffController {}
