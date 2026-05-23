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
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { memoryStorage } from 'multer';
import { Role } from '@fonte/types';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { DocumentTemplateService } from '../document-template/document-template.service';
import { CreateResidentDto } from './dto/create-resident.dto';
import { GenerateAccessDto } from './dto/generate-access.dto';
import { ListResidentsDto } from './dto/list-residents.dto';
import { ResetResidentPasswordDto } from './dto/reset-resident-password.dto';
import { UpdateResidentDto } from './dto/update-resident.dto';
import { ResidentAttachment } from './resident-attachment.entity';
import { ResidentDocument } from './resident-document.entity';
import { Admission } from './admission.entity';
import { ResidentDocumentView, ResidentMeView } from './resident.service';
import { Resident } from './resident.entity';
import { ResidentService } from './resident.service';
import { ReadmitResidentDto } from './dto/readmit-resident.dto';

const photoOptions = {
  storage: memoryStorage(),
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (error: Error | null, acceptFile: boolean) => void) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new BadRequestException('Apenas imagens são permitidas'), false);
    }
    cb(null, true);
  },
};

const attachmentOptions = {
  storage: memoryStorage(),
};

const signedDocOptions = {
  storage: memoryStorage(),
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
  findAll(@Query() dto: ListResidentsDto): Promise<{ data: Resident[]; total: number; page: number; limit: number }> {
    return this.residentService.findAll(dto);
  }

  @Get('me')
  @Roles(Role.RESIDENT)
  getMe(@CurrentUser() user: AuthenticatedUser): Promise<ResidentMeView> {
    return this.residentService.findMe(user.userId);
  }

  @Post('me/photo')
  @Roles(Role.RESIDENT)
  @UseInterceptors(FileInterceptor('file', photoOptions))
  uploadPhotoMe(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 })],
        exceptionFactory: () => new BadRequestException('Arquivo muito grande: máximo 5 MB'),
      }),
    )
    file: Express.Multer.File,
  ): Promise<ResidentMeView> {
    return this.residentService.uploadPhotoMe(user.userId, file);
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

  @Post(':id/readmit')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  readmit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReadmitResidentDto,
  ): Promise<Resident> {
    return this.residentService.readmit(id, dto);
  }

  @Get(':id/admissions')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR)
  getAdmissions(@Param('id', ParseUUIDPipe) id: string): Promise<Admission[]> {
    return this.residentService.findAdmissions(id);
  }

  @Post(':id/access')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  generateAccess(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GenerateAccessDto,
  ): Promise<Resident> {
    return this.residentService.generateAccess(id, dto.email, dto.password);
  }

  @Post(':id/access/reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR)
  resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetResidentPasswordDto,
  ): Promise<void> {
    return this.residentService.resetPassword(id, dto.password);
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
