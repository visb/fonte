import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateResidentDto } from './create-resident.dto';

/**
 * Um familiar do payload de commit do import. Mínimo necessário para satisfazer
 * a regra de negócio "resident exige ≥1 relative"; o acesso digital é gerado
 * depois, pela tela de familiares.
 */
export class CommitImportRelativeDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsString()
  relationship?: string | null;
}

/**
 * Payload do commit do import aprovado (story 103): a ficha revisada, os
 * familiares, o histórico de contribuição (competências ISO YYYY-MM-01) e a
 * foto opcional em base64. Persistido atomicamente pelo `ImportService.commit`.
 */
export class CommitImportDto {
  @ValidateNested()
  @Type(() => CreateResidentDto)
  resident: CreateResidentDto;

  // Pode vir vazio: ficha histórica sem familiar conhecido. A regra "≥1
  // relative" vale só para o acolhimento manual — no import em lote o familiar
  // pode ser cadastrado depois.
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CommitImportRelativeDto)
  relatives: CommitImportRelativeDto[];

  @IsArray()
  @IsDateString({}, { each: true })
  contributionMonths: string[];

  @IsOptional()
  @IsString()
  photoBase64?: string | null;
}
