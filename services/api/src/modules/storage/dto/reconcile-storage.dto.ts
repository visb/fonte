import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

/**
 * Query da reconciliação de órfãos (story 93). `apply` é dry-run por padrão:
 * sem a flag explícita `?apply=true`, nada é apagado — apenas relatado.
 */
export class ReconcileStorageDto {
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  apply?: boolean = false;
}
