import { Transform } from 'class-transformer';
import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { INVALID_CPF_MESSAGE, isValidCpf, normalizeCpf } from '@fonte/types';

/**
 * Story 219 — CPF gravado só com dígitos. Normaliza no `@Transform`: string
 * (mascarada ou não) vira dígitos e vazio vira `null`; `undefined` continua
 * `undefined` (campo ausente não é "limpar o CPF"). Valor que não é string
 * passa intacto para o `@IsString`/`@IsCpf` recusar.
 */
export function NormalizeCpf(): PropertyDecorator {
  return Transform(({ value }) => {
    if (value === undefined) return undefined;
    if (value === null || typeof value === 'string') return normalizeCpf(value);
    return value;
  });
}

@ValidatorConstraint({ name: 'isCpf', async: false })
export class IsCpfConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && isValidCpf(value);
  }

  defaultMessage(_args?: ValidationArguments): string {
    return INVALID_CPF_MESSAGE;
  }
}

/**
 * CPF com 11 dígitos e DV válido. Usar junto de `@IsOptional()` (null/ausente
 * não é julgado) e de `@NormalizeCpf()`. Só nos DTOs em que o CPF é sempre
 * escrita nova (create/import): na edição, a ficha legada com CPF inválido
 * continua salvável — o DV é julgado no service só quando o CPF muda.
 */
export function IsCpf(options?: ValidationOptions): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'isCpf',
      target: target.constructor,
      propertyName: propertyName as string,
      options: { message: INVALID_CPF_MESSAGE, ...options },
      validator: IsCpfConstraint,
    });
  };
}
