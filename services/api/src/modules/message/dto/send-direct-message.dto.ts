import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class SendDirectMessageDto {
  @IsUUID()
  staffId: string;

  @IsUUID()
  relativeId: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  attachmentUrl?: string;

  @IsOptional()
  @IsIn(['image', 'audio', 'document'])
  attachmentType?: string;
}
