import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@fonte/types';
import { EventService } from './event.service';
import { EventRegistrationService } from './event-registration.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { ListEventsDto } from './dto/list-events.dto';

const bannerOptions = {
  storage: memoryStorage(),
  fileFilter: (
    _req: unknown,
    file: Express.Multer.File,
    cb: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new BadRequestException('Apenas imagens são permitidas'), false);
    }
    cb(null, true);
  },
};

@Controller('events')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.COORDINATOR)
export class EventController {
  constructor(
    private service: EventService,
    private registrationService: EventRegistrationService,
  ) {}

  @Post()
  create(@Body() dto: CreateEventDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(@Query() filters: ListEventsDto) {
    return this.service.findAll(filters);
  }

  @Get(':id/registrations')
  listRegistrations(@Param('id', ParseUUIDPipe) id: string) {
    return this.registrationService.listRegistrations(id);
  }

  /** Reenvia o link de pagamento da inscrição por e-mail + WhatsApp (story 70). */
  @Post(':id/registrations/:regId/resend-payment-link')
  resendPaymentLink(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('regId', ParseUUIDPipe) regId: string,
  ) {
    return this.registrationService.resendPaymentLink(id, regId);
  }

  /** Remove uma inscrição e limpa seus comprovantes do bucket (story 93). */
  @Delete(':id/registrations/:regId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteRegistration(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('regId', ParseUUIDPipe) regId: string,
  ) {
    return this.registrationService.deleteRegistration(id, regId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEventDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }

  @Post(':id/banner')
  @UseInterceptors(FileInterceptor('file', bannerOptions))
  uploadBanner(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 20 * 1024 * 1024 })],
        exceptionFactory: () => new BadRequestException('Arquivo muito grande: máximo 20 MB'),
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.service.uploadBanner(id, file);
  }
}
