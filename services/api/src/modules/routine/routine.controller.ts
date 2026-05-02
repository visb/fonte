import { Controller, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('routines')
@UseGuards(JwtAuthGuard)
export class RoutineController {}
