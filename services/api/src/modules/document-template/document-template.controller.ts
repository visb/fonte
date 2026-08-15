import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ReceiptType, Role, TemplateAvailability, TemplateKind } from '@fonte/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { DocumentTemplate } from './document-template.entity';
import { DocumentTemplateService } from './document-template.service';

const imageUploadOptions = { storage: memoryStorage() };

@Controller('document-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocumentTemplateController {
  constructor(private service: DocumentTemplateService) {}

  // Story 178 — `kind` opcional com default RESIDENT no service (decisão 8):
  // quem já consumia esta rota (aba de Anexos, wizard) continua vendo só
  // documento de filho, sem saber que recibos existem.
  @Get()
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.SERVANT)
  findAll(@Query('kind') kind?: string): Promise<DocumentTemplate[]> {
    return this.service.findAll(kind);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<DocumentTemplate> {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.COORDINATOR)
  create(
    @Body('name') name: string,
    @Body('content') content: string,
    @Body('isRequired') isRequired?: boolean,
    @Body('signAtAdmission') signAtAdmission?: boolean,
    // Story 160 — validado contra TemplateAvailability no service (regra de
    // negócio); aqui só roteia o valor cru do corpo.
    @Body('availableFor') availableFor?: string,
    // Story 178 — valores crus; as invariantes kind × receiptType são regra de
    // negócio e ficam no service.
    @Body('kind') kind?: string,
    @Body('receiptType') receiptType?: string,
  ): Promise<DocumentTemplate> {
    return this.service.create(
      name,
      content ?? '',
      isRequired ?? false,
      signAtAdmission ?? false,
      availableFor,
      kind,
      receiptType,
    );
  }

  @Post('images')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  @UseInterceptors(FileInterceptor('file', imageUploadOptions))
  async uploadImage(
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<{ url: string }> {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado');
    if (!file.mimetype.startsWith('image/')) throw new BadRequestException('Apenas imagens sÃ£o permitidas');
    if (file.size > 5 * 1024 * 1024) throw new BadRequestException('Imagem muito grande: mÃ¡ximo 5 MB');
    return this.service.uploadImage(file);
  }

  @Put(':id')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('name') name?: string,
    @Body('content') content?: string,
    @Body('isRequired') isRequired?: boolean,
    @Body('signAtAdmission') signAtAdmission?: boolean,
    @Body('availableFor') availableFor?: string,
    @Body('kind') kind?: string,
    @Body('receiptType') receiptType?: string | null,
  ): Promise<DocumentTemplate> {
    const data: Partial<
      Pick<
        DocumentTemplate,
        'name' | 'content' | 'isRequired' | 'signAtAdmission' | 'availableFor' | 'kind' | 'receiptType'
      >
    > = {};
    if (name !== undefined) data.name = name;
    if (content !== undefined) data.content = content;
    if (isRequired !== undefined) data.isRequired = isRequired;
    if (signAtAdmission !== undefined) data.signAtAdmission = signAtAdmission;
    // Valor cru: o service valida contra o enum antes de persistir (story 160).
    if (availableFor !== undefined) data.availableFor = availableFor as TemplateAvailability;
    // Story 178 — idem para kind/receiptType: as invariantes ficam no service.
    if (kind !== undefined) data.kind = kind as TemplateKind;
    if (receiptType !== undefined) data.receiptType = receiptType as ReceiptType | null;
    return this.service.update(id, data);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.ADMIN, Role.COORDINATOR)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.remove(id);
  }
}
