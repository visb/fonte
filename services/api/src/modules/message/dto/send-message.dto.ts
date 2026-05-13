import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class SendMessageDto {
  @IsUUID()
  residentId: string;

  @IsUUID()
  relativeId: string;

  @IsString()
  @IsNotEmpty()
  content: string;
}
