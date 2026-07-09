import { ArrayMaxSize, IsArray, IsString } from 'class-validator';

/**
 * Checagem em lote de fichas já importadas por nome de arquivo (antes da
 * extração por IA). O teto alto acomoda um drop de milhares de fichas numa
 * chamada só, sem abrir espaço para payload ilimitado.
 */
export class CheckImportFilesDto {
  @IsArray()
  @ArrayMaxSize(5000)
  @IsString({ each: true })
  fileNames: string[];
}
