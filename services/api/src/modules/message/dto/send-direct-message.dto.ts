import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class SendDirectMessageDto {
  @IsUUID()
  staffId: string;

  @IsUUID()
  relativeId: string;

  @IsString()
  @IsNotEmpty()
  content: string;
}
