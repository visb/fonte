import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentTemplate } from './document-template.entity';
import { DocumentTemplateController } from './document-template.controller';
import { DocumentTemplateService } from './document-template.service';

@Module({
  imports: [TypeOrmModule.forFeature([DocumentTemplate])],
  controllers: [DocumentTemplateController],
  providers: [DocumentTemplateService],
  exports: [DocumentTemplateService],
})
export class DocumentTemplateModule {}
