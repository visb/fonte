import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentTemplateModule } from '../document-template/document-template.module';
import { User } from '../user/user.entity';
import { Resident } from './resident.entity';
import { ResidentAttachment } from './resident-attachment.entity';
import { ResidentDocument } from './resident-document.entity';
import { ResidentController } from './resident.controller';
import { ResidentService } from './resident.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Resident, ResidentDocument, ResidentAttachment, User]),
    DocumentTemplateModule,
  ],
  controllers: [ResidentController],
  providers: [ResidentService],
  exports: [ResidentService],
})
export class ResidentModule {}
