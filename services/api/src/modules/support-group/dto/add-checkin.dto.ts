import { IsUUID } from 'class-validator';

export class AddCheckinDto {
  @IsUUID()
  residentId: string;
}
