import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Corpo do POST /public/associates/:token/subscribe (story 41).
 * Valor é FIXO (= contribuição do cadastro), então só o cartão é enviado.
 */
export class SubscribeDto {
  /** Token do cartão tokenizado client-side na Pagar.me (PAN nunca chega aqui). */
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  cardToken: string;
}
