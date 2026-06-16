import { IsNumber, IsPositive, IsString, MaxLength, MinLength } from 'class-validator';

/** Corpo do POST /public/associates/:token/subscribe (story 38). */
export class SubscribeDto {
  /** Valor líquido que o associado quer contribuir (a Fonte recebe cheio). */
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  contributionAmount: number;

  /** Token do cartão tokenizado client-side no AbacatePay (PAN nunca chega aqui). */
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  cardToken: string;
}
