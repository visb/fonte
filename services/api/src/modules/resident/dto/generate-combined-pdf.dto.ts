import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

// Story 152 — lista de templates a mesclar num único PDF de impressão. POST
// (e não query string) porque a seleção pode ficar longa demais para a URL.
export class GenerateCombinedPdfDto {
  @IsArray()
  @ArrayNotEmpty({ message: 'Selecione ao menos um documento.' })
  @IsUUID('4', { each: true })
  templateIds: string[];
}
