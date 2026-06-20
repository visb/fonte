import { IsIn, IsString, ValidateIf } from 'class-validator';
import { EventPaymentMethod } from '@fonte/types';

/**
 * Body do POST /public/event-payments/:token/pay (story 69).
 * Cartão exige `cardToken` (tokenizado client-side); PIX dispensa dados de cartão.
 */
export class PayEventDto {
  @IsIn(['credit_card', 'pix'])
  method: EventPaymentMethod;

  /** Token do cartão tokenizado client-side. Obrigatório para `credit_card`. */
  @ValidateIf((o: PayEventDto) => o.method === 'credit_card')
  @IsString()
  cardToken?: string;
}
