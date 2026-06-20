import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { RegistrationFieldType } from '@fonte/types';

/**
 * Tipos que exigem a lista de `options` não-vazia (story 68).
 */
const OPTION_TYPES: RegistrationFieldType[] = ['select', 'multi_select'];

/**
 * Definição de um campo custom do formulário de inscrição (story 68).
 * O `id` é estável por campo: gerado no backend quando ausente, para casar
 * resposta↔campo mesmo se o label mudar.
 */
export class RegistrationFieldDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  id?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  label: string;

  @IsEnum([
    'short_text',
    'long_text',
    'number',
    'boolean',
    'select',
    'multi_select',
    'date',
    'email',
    'phone',
    'file',
  ] as RegistrationFieldType[])
  type: RegistrationFieldType;

  @IsBoolean()
  required: boolean;

  @IsInt()
  @Min(0)
  order: number;

  // Options obrigatório e não-vazio só p/ select/multi_select.
  @ValidateIf((o: RegistrationFieldDto) => OPTION_TYPES.includes(o.type))
  @IsArray()
  @ArrayMinSize(1, { message: 'options é obrigatório e não pode ser vazio para select/multi_select' })
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(255, { each: true })
  options?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(255)
  placeholder?: string;
}
