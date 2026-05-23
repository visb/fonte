import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentTemplateModule } from '../document-template/document-template.module';
import { ResidentFollowUpModule } from '../resident-follow-up/resident-follow-up.module';
import { User } from '../user/user.entity';
import { Resident } from './resident.entity';
import { ResidentAttachment } from './resident-attachment.entity';
import { ResidentDocument } from './resident-document.entity';
import { Admission } from './admission.entity';
import { ResidentController } from './resident.controller';
import { ResidentService } from './resident.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Resident, ResidentDocument, ResidentAttachment, User, Admission]),
    DocumentTemplateModule,
    ResidentFollowUpModule,
  ],
  controllers: [ResidentController],
  providers: [ResidentService],
  exports: [ResidentService],
})
export class ResidentModule {}
