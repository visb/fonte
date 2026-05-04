import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';
import { Role } from '@fonte/types';
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
  @Roles(Role.ADMIN, Role.COORDINATOR, Role.OPERATOR)
  findAll(): Promise<DocumentTemplate[]> {
    return this.service.findAll();
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
  ): Promise<DocumentTemplate> {
    return this.service.create(name, content ?? '', isRequired ?? false);
  }

  @Put(':id')
  @Roles(Role.ADMIN, Role.COORDINATOR)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('name') name?: string,
    @Body('content') content?: string,
    @Body('isRequired') isRequired?: boolean,
  ): Promise<DocumentTemplate> {
    const data: Partial<Pick<DocumentTemplate, 'name' | 'content' | 'isRequired'>> = {};
    if (name !== undefined) data.name = name;
    if (content !== undefined) data.content = content;
    if (isRequired !== undefined) data.isRequired = isRequired;
    return this.service.update(id, data);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(Role.ADMIN, Role.COORDINATOR)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.remove(id);
  }
}
