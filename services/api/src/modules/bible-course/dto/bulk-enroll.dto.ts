import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class BulkEnrollDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  residentIds: string[];
}
