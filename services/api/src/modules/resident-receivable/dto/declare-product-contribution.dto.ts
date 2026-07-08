import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Validate,
  ValidateNested,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Garante que cada linha use exatamente um modo:
 *  - Catálogo: `inventoryItemId` presente + `description` ausente + `quantity > 0`.
 *  - Avulso: `description` presente + `inventoryItemId` ausente.
 * (item XOR descrição; quantidade obrigatória e positiva no modo catálogo.)
 */
@ValidatorConstraint({ name: 'productContributionLine', async: false })
export class ProductContributionLineConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const line = args.object as ProductContributionLineDto;
    const hasItem = line.inventoryItemId != null && line.inventoryItemId !== '';
    const hasDescription = line.description != null && line.description !== '';

    // item XOR descrição — exatamente um dos dois.
    if (hasItem === hasDescription) return false;

    // Modo catálogo exige quantidade positiva.
    if (hasItem && !(typeof line.quantity === 'number' && line.quantity > 0)) {
      return false;
    }

    return true;
  }

  defaultMessage(): string {
    return 'Cada linha deve ter item (catálogo, com quantidade > 0) OU descrição (avulso), nunca ambos.';
  }
}

export class ProductContributionLineDto {
  @IsOptional()
  @IsUUID()
  inventoryItemId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  quantity?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  unit?: string;

  // Valida o modo (item XOR descrição) na própria linha.
  @Validate(ProductContributionLineConstraint)
  private readonly _mode?: unknown;
}

export class DeclareProductContributionDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProductContributionLineDto)
  lines: ProductContributionLineDto[];
}
