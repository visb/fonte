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
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { Role } from '@fonte/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { DocumentTemplateService } from '../document-template/document-template.service';
import { CreateResidentDto } from './dto/create-resident.dto';
import { UpdateResidentDto } from './dto/update-resident.dto';
import { ResidentAttachment } from './resident-attachment.entity';
import { ResidentDocument } from './resident-document.entity';
import { ResidentDocumentView } from './resident.service';
import { Resident } from './resident.entity';
import { ResidentService } from './resident.service';

const photoOptions = {
  storage: diskStorage({
    destination: join(process.cwd(), 'uploads', 'residents'),
    filename: (_req: unknown, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
    },
  }),
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (error: Error | null, acceptFile: boolean) => void) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new BadRequestException('Apenas imagens são permitidas'), false);
    }
    cb(null, true);
  },
};

const attachmentOptions = {
  storage: diskStorage({
    destination: join(process.cwd(), 'uploads', 'attachments'),
    filename: (_req: unknown, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
    },
  }),
};

const signedDocOptions = {
  storage: diskStorage({
    destination: join(process.cwd(), 'uploads', 'documents'),
    filename: (_req: unknown, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `signed_${uniqueSuffix}${extname(file.originalname)}`);
    },
  }),
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (error: Error | null, acceptFile: boolean) => void) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new BadRequestException('Apenas PDFs são permitidos'), false);
    }
    cb(null, true);
  },
};

@Controller('residents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ResidentController {
  constructor(
    private residentService: ResidentService,
    private documentTemplateService: DocumentTemplateService,
  ) {}

  @Get()
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR)
  findAll(): Promise<Resident[]> {
    return this.residentService.findAll();
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR)
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Resident> {
    return this.residentService.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.COORDINATOR)
  create(@Body() dto: CreateResidentDto): Promise<Resident> {
    return this.residentService.create(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateResidentDto,
  ): Promise<Resident> {
    return this.residentService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.residentService.remove(id);
  }

  @Post(':id/photo')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  @UseInterceptors(FileInterceptor('file', photoOptions))
  uploadPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 })],
        exceptionFactory: () => new BadRequestException('Arquivo muito grande: máximo 5 MB'),
      }),
    )
    file: Express.Multer.File,
  ): Promise<Resident> {
    return this.residentService.uploadPhoto(id, file);
  }

  @Get(':id/documents')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR)
  getDocuments(@Param('id', ParseUUIDPipe) id: string): Promise<ResidentDocumentView[]> {
    return this.residentService.findDocuments(id);
  }

  @Get(':id/documents/:templateId/render')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR)
  async renderDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @Res() res: Response,
  ): Promise<void> {
    const resident = await this.residentService.findOne(id);
    const html = await this.documentTemplateService.renderForResident(templateId, resident);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  @Get(':id/documents/:templateId/pdf')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR)
  async downloadPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @Res() res: Response,
  ): Promise<void> {
    const resident = await this.residentService.findOne(id);
    const { buffer, filename } = await this.documentTemplateService.generatePdf(templateId, resident);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Get(':id/attachments')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR)
  getAttachments(@Param('id', ParseUUIDPipe) id: string): Promise<ResidentAttachment[]> {
    return this.residentService.findAttachments(id);
  }

  @Post(':id/attachments')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  @UseInterceptors(FileInterceptor('file', attachmentOptions))
  addAttachment(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 20 * 1024 * 1024 })],
        exceptionFactory: () => new BadRequestException('Arquivo muito grande: máximo 20 MB'),
      }),
    )
    file: Express.Multer.File,
  ): Promise<ResidentAttachment> {
    return this.residentService.addAttachment(id, file, file.originalname);
  }

  @Delete(':id/attachments/:attachmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.ADMIN, Role.COORDINATOR)
  removeAttachment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
  ): Promise<void> {
    return this.residentService.removeAttachment(id, attachmentId);
  }

  @Post(':id/documents/:templateId/signed')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  @UseInterceptors(FileInterceptor('file', signedDocOptions))
  uploadSignedDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 20 * 1024 * 1024 })],
        exceptionFactory: () => new BadRequestException('Arquivo muito grande: máximo 20 MB'),
      }),
    )
    file: Express.Multer.File,
  ): Promise<ResidentDocument> {
    return this.residentService.uploadSignedDocument(id, templateId, file);
  }
}
