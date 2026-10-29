import { IsIn } from 'class-validator';
import { ReceivableStatus } from '@fonte/types';

/**
 * Troca manual PENDENTE ↔ CANCELADA de uma parcela. PAGA não entra: pagar e
 * desfazer pagamento têm rotas próprias (`/payment` e `/reopen`).
 */
export class SetReceivableStatusDto {
  @IsIn([ReceivableStatus.PENDING, ReceivableStatus.CANCELED])
  status: ReceivableStatus.PENDING | ReceivableStatus.CANCELED;
}
