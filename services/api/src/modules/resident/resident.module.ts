import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentTemplateModule } from '../document-template/document-template.module';
import { ResidentFollowUpModule } from '../resident-follow-up/resident-follow-up.module';
import { ResidentReceivableModule } from '../resident-receivable/resident-receivable.module';
import { NotificationModule } from '../notification/notification.module';
import { StaffModule } from '../staff/staff.module';
import { User } from '../user/user.entity';
import { Resident } from './resident.entity';
import { ResidentAttachment } from './resident-attachment.entity';
import { ResidentDocument } from './resident-document.entity';
import { Admission } from './admission.entity';
import { ResidentController } from './resident.controller';
import { ResidentService } from './resident.service';
import { DocxParserService } from './docx-parser.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Resident, ResidentDocument, ResidentAttachment, User, Admission]),
    DocumentTemplateModule,
    ResidentFollowUpModule,
    ResidentReceivableModule,
    NotificationModule,
    StaffModule,
  ],
  controllers: [ResidentController],
  providers: [ResidentService, DocxParserService],
  exports: [ResidentService],
})
export class ResidentModule {}
