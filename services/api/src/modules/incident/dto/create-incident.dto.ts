import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { IncidentType } from '@fonte/types';

export const INCIDENT_TYPE_REQUIRED_MESSAGE = 'Informe se a ocorrência é positiva ou negativa';

export class CreateIncidentDto {
  @IsDateString()
  date: string;

  /**
   * Story 229: positiva ou negativa. Obrigatório — só pode faltar no payload
   * legado (com `severity`, de APK antigo / fila offline), que vira `NEGATIVE`.
   * Se vier, é sempre validado, mesmo junto com `severity`.
   */
  @ValidateIf((o: CreateIncidentDto) => o.type !== undefined || o.severity === undefined)
  @IsEnum(IncidentType, { message: INCIDENT_TYPE_REQUIRED_MESSAGE })
  type?: IncidentType;

  /**
   * @deprecated Story 229 — severidade removida do produto. APKs em campo e itens
   * parados na fila offline ainda mandam este campo (sem `type`); ele é aceito
   * (por causa do `forbidNonWhitelisted`) e ignorado. Remover quando nenhum APK
   * antigo estiver em uso.
   */
  @IsOptional()
  @IsString()
  severity?: string;

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
