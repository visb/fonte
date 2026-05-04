import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { DocumentType, Role } from '@fonte/types';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { DocumentTemplate } from './document-template.entity';
import { DocumentTemplateService } from './document-template.service';

@Controller('document-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocumentTemplateController {
  constructor(private service: DocumentTemplateService) {}

  @Get()
  @Roles(Role.ADMIN, Role.COORDINATOR)
  findAll(): Promise<DocumentTemplate[]> {
    return this.service.findAll();
  }

  @Get(':type')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  findOne(@Param('type') type: string): Promise<DocumentTemplate> {
    return this.service.findOne(type as DocumentType);
  }

  @Put(':type')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  update(
    @Param('type') type: string,
    @Body('content') content: string,
  ): Promise<DocumentTemplate> {
    return this.service.update(type as DocumentType, content);
  }
}
