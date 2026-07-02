import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

/** Body do disparo de convites via WhatsApp aos servos (story 95). */
export class InviteEventStaffDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  staffIds: string[];
}
