import {
  BadRequestException,
  Body,
  Controller,
  Get,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { EventRegistrationService } from './event-registration.service';
import { RegisterToEventDto } from './dto/register-to-event.dto';

// Mesma allowlist do anexo do payable: imagens ou PDF (campo `file`, story 68).
const registrationFileOptions = {
  storage: memoryStorage(),
  fileFilter: (
    _req: unknown,
    file: Express.Multer.File,
    cb: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    const ok = file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf';
    if (!ok) return cb(new BadRequestException('Apenas imagens ou PDF são permitidos'), false);
    cb(null, true);
  },
};

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

  /**
   * Upload de arquivo de um campo `file` da inscrição (story 68). Throttle por
   * IP mais apertado; grava no storage e devolve a fileKey para o register.
   */
  @Post(':id/registration-files')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file', registrationFileOptions))
  uploadRegistrationFile(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 20 * 1024 * 1024 })],
        exceptionFactory: () => new BadRequestException('Arquivo muito grande: máximo 20 MB'),
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.service.uploadRegistrationFile(id, file);
  }
}
