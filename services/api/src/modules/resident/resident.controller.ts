import { Controller, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('residents')
@UseGuards(JwtAuthGuard)
export class ResidentController {}
