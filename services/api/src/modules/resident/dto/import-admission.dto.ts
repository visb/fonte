import { IsDateString, IsOptional } from 'class-validator';

/**
 * Um acolhimento (par entrada→saída) do payload de commit do import em lote
 * (story 121). A planilha pode trazer vários pares para o mesmo filho; cada um
 * vira um `Admission`. `exitDate` é opcional (acolhimento em aberto — tipicamente
 * o mais recente). O status terminal de cada acolhimento fechado é derivado no
 * service pela permanência entrada→saída (regra dos 6 meses, story 120).
 */
export class ImportAdmissionDto {
  @IsDateString()
  entryDate: string;

  @IsOptional()
  @IsDateString()
  exitDate?: string | null;
}
