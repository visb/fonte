import { Controller, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('incidents')
@UseGuards(JwtAuthGuard)
export class IncidentController {}
