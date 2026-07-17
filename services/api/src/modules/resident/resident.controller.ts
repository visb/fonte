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
import { RevealSensitive } from '../../common/decorators/reveal-sensitive.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { DocumentTemplateService } from '../document-template/document-template.service';
import { CreateResidentDto } from './dto/create-resident.dto';
import { GenerateAccessDto } from './dto/generate-access.dto';
import { PromoteToServantDto } from './dto/promote-to-servant.dto';
import { Staff } from '../staff/staff.entity';
import { ListResidentsDto } from './dto/list-residents.dto';
import { ResetResidentPasswordDto } from './dto/reset-resident-password.dto';
import { UpdateResidentDto } from './dto/update-resident.dto';
import { ResidentAttachment } from './resident-attachment.entity';
import { ResidentDocument } from './resident-document.entity';
import { Admission } from './admission.entity';
import { AdmissionDocumentView, ResidentDocumentView, ResidentMeView } from './resident.service';
import { Resident } from './resident.entity';
import { ResidentService } from './resident.service';
import { ReadmitResidentDto } from './dto/readmit-resident.dto';
import { ResidentFollowUpService, ResidentFollowUpView } from '../resident-follow-up/resident-follow-up.service';
import { CreateFollowUpDto } from '../resident-follow-up/dto/create-follow-up.dto';
import { BulkCreateContributionsDto } from '../resident-follow-up/dto/bulk-create-contributions.dto';
import { ResidentReceivableService, ResidentReceivableView } from '../resident-receivable/resident-receivable.service';
import {
  ProductContributionView,
  ReceivableProductContributionService,
} from '../resident-receivable/receivable-product-contribution.service';
import { DeclareProductContributionDto } from '../resident-receivable/dto/declare-product-contribution.dto';
import { RegisterPaymentDto } from '../resident-receivable/dto/register-payment.dto';
import { UpdateContributionPlanDto } from '../resident-receivable/dto/update-contribution-plan.dto';
import { SetContributionExemptDto } from '../resident-receivable/dto/set-contribution-exempt.dto';
import { GetContributionsReportDto } from './dto/get-contributions-report.dto';
import { ContributionsReportResponse } from '@fonte/types';
import { DocxParserService, ParseDocxResult } from './docx-parser.service';
import { SpreadsheetImportService } from './spreadsheet-parser.service';
import { ImportMatchService, ImportPreviewResult } from './import-match.service';
import { ImportService } from './import.service';
import { CommitImportDto } from './dto/commit-import.dto';
import { CheckImportFilesDto } from './dto/check-import-files.dto';
import { CheckImportConflictResult, ParseSpreadsheetResult, SpreadsheetImportRow } from '@fonte/types';

const photoOptions = {
  storage: memoryStorage(),
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (error: Error | null, acceptFile: boolean) => void) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new BadRequestException('Apenas imagens sÃ£o permitidas'), false);
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
      return cb(new BadRequestException('Apenas PDFs sÃ£o permitidos'), false);
    }
    cb(null, true);
  },
};

const docxOptions = {
  storage: memoryStorage(),
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (error: Error | null, acceptFile: boolean) => void) => {
    if (file.mimetype !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return cb(new BadRequestException('Apenas arquivos .docx sÃ£o permitidos'), false);
    }
    cb(null, true);
  },
};

const spreadsheetOptions = {
  storage: memoryStorage(),
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (error: Error | null, acceptFile: boolean) => void) => {
    if (file.mimetype !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      return cb(new BadRequestException('Apenas arquivos .xlsx sÃ£o permitidos'), false);
    }
    cb(null, true);
  },
};

/**
 * Faz o parse do campo `rows` (JSON string de `SpreadsheetImportRow[]`) que vem
 * no mesmo `multipart/form-data` da ficha. Validação de entrada — malformado ou
 * fora do formato de lista resulta em 400.
 */
function parseRows(rowsRaw: string): SpreadsheetImportRow[] {
  if (rowsRaw === undefined || rowsRaw === null || rowsRaw === '') {
    throw new BadRequestException('O campo "rows" com as linhas da planilha é obrigatório.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rowsRaw);
  } catch {
    throw new BadRequestException('O campo "rows" não é um JSON válido.');
  }
  if (!Array.isArray(parsed)) {
    throw new BadRequestException('O campo "rows" deve ser uma lista de linhas da planilha.');
  }
  return parsed as SpreadsheetImportRow[];
}

@Controller('residents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ResidentController {
  constructor(
    private residentService: ResidentService,
    private documentTemplateService: DocumentTemplateService,
    private followUpService: ResidentFollowUpService,
    private receivableService: ResidentReceivableService,
    private productContributionService: ReceivableProductContributionService,
    private docxParserService: DocxParserService,
    private spreadsheetImportService: SpreadsheetImportService,
    private importMatchService: ImportMatchService,
    private importService: ImportService,
  ) {}

  @Get()
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.SERVANT)
  findAll(
    @Query() dto: ListResidentsDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: Resident[]; total: number; page: number; limit: number }> {
    return this.residentService.findAll(dto, { role: user.role, userId: user.userId });
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
        exceptionFactory: () => new BadRequestException('Arquivo muito grande: mÃ¡ximo 5 MB'),
      }),
    )
    file: Express.Multer.File,
  ): Promise<ResidentMeView> {
    return this.residentService.uploadPhotoMe(user.userId, file);
  }

  @Get('contributions/report')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  getContributionsReport(@Query() dto: GetContributionsReportDto): Promise<ContributionsReportResponse> {
    return this.residentService.getContributionsReport(dto);
  }

  @Post('import/parse-docx')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  // O CPF/RG extraídos preenchem o formulário de import individual; só
  // ADMIN/COORDINATOR chegam aqui, então devolvemos o documento completo.
  @RevealSensitive()
  @UseInterceptors(FileInterceptor('file', docxOptions))
  parseDocx(
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 })],
        exceptionFactory: () => new BadRequestException('Arquivo muito grande: mÃ¡ximo 5 MB'),
      }),
    )
    file: Express.Multer.File,
  ): Promise<ParseDocxResult> {
    return this.docxParserService.parseDocx(file.buffer);
  }

  @Post('import/parse-spreadsheet')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  // O CPF é a chave de match do import (story 102); só ADMIN/COORDINATOR chegam
  // aqui, então devolvemos o documento completo em vez de mascarado.
  @RevealSensitive()
  @UseInterceptors(FileInterceptor('file', spreadsheetOptions))
  parseSpreadsheet(
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 })],
        exceptionFactory: () => new BadRequestException('Arquivo muito grande: mÃ¡ximo 10 MB'),
      }),
    )
    file: Express.Multer.File,
  ): Promise<ParseSpreadsheetResult> {
    return this.spreadsheetImportService.parseSpreadsheet(file.buffer);
  }

  @Post('import/parse-docx-with-spreadsheet')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  // Extrai a ficha .docx e a cruza com as linhas da planilha (story 102). O CPF
  // viaja no match, então devolvemos o documento completo em vez de mascarado.
  @RevealSensitive()
  @UseInterceptors(FileInterceptor('file', docxOptions))
  parseDocxWithSpreadsheet(
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 })],
        exceptionFactory: () => new BadRequestException('Arquivo muito grande: mÃ¡ximo 5 MB'),
      }),
    )
    file: Express.Multer.File,
    @Body('rows') rowsRaw: string,
  ): Promise<ImportPreviewResult> {
    return this.importMatchService.parseDocxWithSpreadsheet(file.buffer, parseRows(rowsRaw));
  }

  @Get('import/check-conflict')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  // Devolve o CPF dos filhos conflitantes (chave do match), então revela o
  // documento completo em vez de mascarado — só ADMIN/COORDINATOR chegam aqui.
  @RevealSensitive()
  checkImportConflict(
    @Query('name') name?: string,
    @Query('cpf') cpf?: string,
  ): Promise<CheckImportConflictResult> {
    return this.importService.checkConflict(name, cpf);
  }

  // Checagem em lote: casa o nome do filho embutido no nome do arquivo com os
  // filhos já cadastrados — roda antes da extração por IA para não gastar
  // crédito com ficha já importada.
  @Post('import/check-files')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  checkImportFiles(
    @Body() dto: CheckImportFilesDto,
  ): Promise<{ matches: Array<{ fileName: string; residentId: string; residentName: string }> }> {
    return this.importService.checkImportedFiles(dto.fileNames);
  }

  @Post('import/commit')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  @RevealSensitive()
  commitImport(
    @Body() dto: CommitImportDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ resident: Resident; contributionsCreated: { created: number; skipped: number } }> {
    return this.importService.commit(dto, user.userId);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.SERVANT)
  @RevealSensitive()
  @Audit('resident.read', 'resident')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Resident> {
    return this.residentService.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.COORDINATOR)
  @RevealSensitive()
  create(@Body() dto: CreateResidentDto): Promise<Resident> {
    return this.residentService.create(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  @RevealSensitive()
  @Audit('resident.update', 'resident')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateResidentDto,
  ): Promise<Resident> {
    return this.residentService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.ADMIN)
  @Audit('resident.delete', 'resident')
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.residentService.remove(id);
  }

  @Post(':id/readmit')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  @RevealSensitive()
  readmit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReadmitResidentDto,
  ): Promise<Resident> {
    return this.residentService.readmit(id, dto);
  }

  @Get(':id/admissions')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.SERVANT)
  getAdmissions(@Param('id', ParseUUIDPipe) id: string): Promise<Admission[]> {
    return this.residentService.findAdmissions(id);
  }

  @Get(':id/follow-ups')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.SERVANT)
  getFollowUps(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ResidentFollowUpView[]> {
    return this.followUpService.findByResident(id, user.role);
  }

  @Post(':id/follow-ups')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.SERVANT)
  createFollowUp(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateFollowUpDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ResidentFollowUpView> {
    return this.followUpService.create(id, dto, user.userId);
  }

  @Post(':id/follow-ups/bulk-contributions')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  bulkCreateContributions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BulkCreateContributionsDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ created: number; skipped: number }> {
    return this.followUpService.bulkCreateContributions(id, dto, user.userId);
  }

  @Post(':id/follow-ups/:followUpId/attachment')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.SERVANT)
  @UseInterceptors(FileInterceptor('file', attachmentOptions))
  uploadFollowUpAttachment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('followUpId', ParseUUIDPipe) followUpId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 20 * 1024 * 1024 })],
        exceptionFactory: () => new BadRequestException('Arquivo muito grande: mÃ¡ximo 20 MB'),
      }),
    )
    file: Express.Multer.File,
  ): Promise<ResidentFollowUpView> {
    return this.followUpService.uploadAttachment(followUpId, id, file);
  }

  @Get(':id/receivables')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  getReceivables(@Param('id', ParseUUIDPipe) id: string): Promise<ResidentReceivableView[]> {
    return this.receivableService.findByResident(id);
  }

  @Patch(':id/contribution-plan')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  updateContributionPlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContributionPlanDto,
  ): Promise<Resident> {
    return this.residentService.updateContributionPlan(id, dto);
  }

  @Patch(':id/contribution-exempt')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  setContributionExempt(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetContributionExemptDto,
  ): Promise<Resident> {
    return this.residentService.setContributionExempt(id, dto.exempt);
  }

  @Post(':id/receivables/:receivableId/payment')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  @UseInterceptors(FileInterceptor('file', attachmentOptions))
  registerReceivablePayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('receivableId', ParseUUIDPipe) receivableId: string,
    @Body() dto: RegisterPaymentDto,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 20 * 1024 * 1024 })],
        fileIsRequired: false,
        exceptionFactory: () => new BadRequestException('Arquivo muito grande: máximo 20 MB'),
      }),
    )
    file?: Express.Multer.File,
  ): Promise<ResidentReceivableView> {
    return this.receivableService.registerPayment(id, receivableId, dto, user.userId, file);
  }

  @Post(':id/receivables/:receivableId/reopen')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  reopenReceivable(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('receivableId', ParseUUIDPipe) receivableId: string,
  ): Promise<ResidentReceivableView> {
    return this.receivableService.reopenPayment(id, receivableId);
  }

  // Contribuição em produtos (story 112): liberada para SERVANT+ (ops usa) —
  // diferente do pagamento em VALOR, que segue restrito a ADMIN/COORDINATOR.
  @Get(':id/receivables/:receivableId/product-contributions')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.SERVANT)
  getProductContributions(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('receivableId', ParseUUIDPipe) receivableId: string,
  ): Promise<ProductContributionView[]> {
    return this.productContributionService.listByReceivable(id, receivableId);
  }

  @Post(':id/receivables/:receivableId/product-contributions')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.SERVANT)
  declareProductContributions(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('receivableId', ParseUUIDPipe) receivableId: string,
    @Body() dto: DeclareProductContributionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProductContributionView[]> {
    return this.productContributionService.declare(id, receivableId, dto, user.userId);
  }

  @Delete(':id/receivables/:receivableId/product-contributions/:contributionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.SERVANT)
  removeProductContribution(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('receivableId', ParseUUIDPipe) receivableId: string,
    @Param('contributionId', ParseUUIDPipe) contributionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.productContributionService.remove(id, receivableId, contributionId, user.userId);
  }

  @Post(':id/access')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  generateAccess(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GenerateAccessDto,
  ): Promise<Resident> {
    return this.residentService.generateAccess(id, dto.email, dto.password);
  }

  @Post(':id/promote-to-servant')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  promoteToServant(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PromoteToServantDto,
  ): Promise<Staff> {
    return this.residentService.promoteToServant(id, dto);
  }

  @Post(':id/access/reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.SERVANT)
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
        exceptionFactory: () => new BadRequestException('Arquivo muito grande: mÃ¡ximo 5 MB'),
      }),
    )
    file: Express.Multer.File,
  ): Promise<Resident> {
    return this.residentService.uploadPhoto(id, file);
  }

  @Get(':id/documents')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.SERVANT)
  getDocuments(@Param('id', ParseUUIDPipe) id: string): Promise<ResidentDocumentView[]> {
    return this.residentService.findDocuments(id);
  }

  @Get(':id/documents/:templateId/render')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.SERVANT)
  async renderDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ): Promise<void> {
    const resident = await this.residentService.findOne(id);
    const html = await this.documentTemplateService.renderForResident(templateId, resident, user.userId);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  @Get(':id/documents/:templateId/pdf')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.SERVANT)
  @Audit('resident.document.pdf', 'resident')
  async downloadPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ): Promise<void> {
    const resident = await this.residentService.findOne(id);
    const { buffer, filename } = await this.documentTemplateService.generatePdf(templateId, resident, user.userId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  // Documentos a assinar no acolhimento (flag signAtAdmission no template),
  // com status de assinatura e caminho do PDF preenchido. Alimenta a aba de
  // anexos do filho.
  @Get(':id/admission-documents')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.SERVANT)
  async getAdmissionDocuments(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AdmissionDocumentView[]> {
    const templates = await this.documentTemplateService.findAdmissionTemplates();
    return this.residentService.findAdmissionDocuments(id, templates);
  }

  @Get(':id/attachments')
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.SERVANT)
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
        exceptionFactory: () => new BadRequestException('Arquivo muito grande: mÃ¡ximo 20 MB'),
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
        exceptionFactory: () => new BadRequestException('Arquivo muito grande: mÃ¡ximo 20 MB'),
      }),
    )
    file: Express.Multer.File,
  ): Promise<ResidentDocument> {
    return this.residentService.uploadSignedDocument(id, templateId, file);
  }
}
