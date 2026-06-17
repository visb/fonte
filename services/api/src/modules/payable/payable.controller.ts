import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
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
import {
  CurrentUser,
  AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { Role } from '@fonte/types';
import { PayableService } from './payable.service';
import { CreatePayableDto } from './dto/create-payable.dto';
import { UpdatePayableDto } from './dto/update-payable.dto';
import { ListPayablesDto } from './dto/list-payables.dto';
import { PayablesSummaryDto } from './dto/payables-summary.dto';
import { PayPayableDto } from './dto/pay-payable.dto';

const attachmentOptions = {
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

@Controller('payables')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class PayableController {
  constructor(private service: PayableService) {}

  @Post()
  create(@Body() dto: CreatePayableDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(dto, user.userId ?? null);
  }

  @Get()
  findAll(@Query() filters: ListPayablesDto) {
    return this.service.findAll(filters);
  }

  // /summary precede /:id para não ser capturado pela rota de detalhe.
  @Get('summary')
  getSummary(@Query() filters: PayablesSummaryDto) {
    return this.service.getSummary(filters);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePayableDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/pay')
  @UseInterceptors(FileInterceptor('file', attachmentOptions))
  pay(
    @Param('id') id: string,
    @Body() dto: PayPayableDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 20 * 1024 * 1024 })],
        fileIsRequired: false,
        exceptionFactory: () => new BadRequestException('Arquivo muito grande: máximo 20 MB'),
      }),
    )
    file?: Express.Multer.File,
  ) {
    return this.service.pay(id, dto, file);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Post(':id/attachment')
  @UseInterceptors(FileInterceptor('file', attachmentOptions))
  uploadAttachment(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 20 * 1024 * 1024 })],
        exceptionFactory: () => new BadRequestException('Arquivo muito grande: máximo 20 MB'),
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.service.uploadAttachment(id, file);
  }

  @Delete(':id/attachment')
  removeAttachment(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.removeAttachment(id);
  }
}
