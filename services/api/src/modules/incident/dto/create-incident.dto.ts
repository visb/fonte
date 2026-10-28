import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { IncidentSeverity } from '@fonte/types';

export class CreateIncidentDto {
  @IsDateString()
  date: string;

  @IsEnum(IncidentSeverity)
  severity: IncidentSeverity;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsUUID()
  houseId: string;

  @IsUUID()
  responsibleId: string;

  /** Story 227: filhos envolvidos (0..N). Vazio/ausente = ocorrência da casa. */
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayUnique()
  residentIds?: string[];

  /**
   * @deprecated Story 227 — formato antigo (um filho só). APKs em campo e itens
   * parados na fila offline ainda mandam este campo; o service o une a
   * `residentIds`. Remover quando nenhum APK antigo estiver em uso.
   */
  @IsOptional()
  @IsUUID()
  residentId?: string | null;
}
