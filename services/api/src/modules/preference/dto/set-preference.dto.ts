import {
  IsDefined,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/** Teto do payload de uma preferência: 4 KB (decisão 2 — não virar depósito). */
export const PREFERENCE_VALUE_MAX_BYTES = 4096;

/**
 * Rejeita `value` cujo JSON serializado ultrapasse o teto de 4 KB. Mede em
 * bytes UTF-8 (não em chars) porque é o tamanho real gravado no jsonb.
 */
@ValidatorConstraint({ name: 'preferenceValueSize', async: false })
export class PreferenceValueSizeConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    try {
      const bytes = Buffer.byteLength(JSON.stringify(value ?? null), 'utf8');
      return bytes <= PREFERENCE_VALUE_MAX_BYTES;
    } catch {
      // Valor não serializável (ciclo) — rejeita.
      return false;
    }
  }

  defaultMessage(): string {
    return `value excede o limite de ${PREFERENCE_VALUE_MAX_BYTES} bytes`;
  }
}

export class SetPreferenceDto {
  /** JSON livre; obrigatório e limitado a 4 KB. */
  @IsDefined({ message: 'value é obrigatório' })
  @Validate(PreferenceValueSizeConstraint)
  value: unknown;
}
