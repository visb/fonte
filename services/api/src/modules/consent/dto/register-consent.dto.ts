import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import type { ConsentPurpose, ConsentSubjectType } from '../consent-record.entity';

const PURPOSES = ['IMAGE_PUBLICATION', 'RELIGIOUS_DISCLOSURE'];
const SUBJECT_TYPES = ['RESIDENT', 'RELATIVE'];

export class RegisterConsentDto {
  @IsIn(SUBJECT_TYPES)
  subjectType: ConsentSubjectType;

  @IsUUID()
  subjectId: string;

  @IsIn(PURPOSES)
  purpose: ConsentPurpose;

  @IsOptional()
  @IsString()
  termVersion?: string;
}
