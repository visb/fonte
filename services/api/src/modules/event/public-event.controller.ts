import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { EventRegistrationService } from './event-registration.service';
import { RegisterToEventDto } from './dto/register-to-event.dto';

/**
 * Endpoints PÚBLICOS de eventos (story 58). SEM JWT — qualquer pessoa lista,
 * vê detalhe e se inscreve. Throttle por IP para mitigar abuso/enumeração.
 */
@Controller('public/events')
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 30, ttl: 60_000 } })
export class PublicEventController {
  constructor(private readonly service: EventRegistrationService) {}

  @Get()
  list() {
    return this.service.listPublic();
  }

  @Get(':id')
  getOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getPublicView(id);
  }

  @Post(':id/register')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  register(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RegisterToEventDto) {
    return this.service.register(id, dto);
  }
}
