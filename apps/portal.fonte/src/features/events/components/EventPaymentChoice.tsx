import { useState } from 'react';
import type { PayEventResult } from '@fonte/types';
import { formatBRL } from '@/lib/money';
import { getErrorMessage } from '@/lib/errors';
import { EventCardForm } from './EventCardForm';
import { PixPayment } from './PixPayment';

type Method = 'credit_card' | 'pix';

interface Props {
  amountCents: number;
  submitting: boolean;
  error: unknown;
  /** Resultado da última tentativa (traz o `pix` quando o método foi PIX). */
  result: PayEventResult | undefined;
  onPay: (data: { method: Method; cardToken?: string }) => void;
}

/**
 * Escolha do método (cartão/PIX) e formulário correspondente (story 70). O valor é
 * read-only (snapshot do gross-up calculado no backend, story 69).
 */
export function EventPaymentChoice({ amountCents, submitting, error, result, onPay }: Props) {
  const [method, setMethod] = useState<Method | null>(null);

  // PIX já gerado: mostra o QR/copia-e-cola.
  if (result?.method === 'pix' && result.pix) {
    return <PixPayment pix={result.pix} />;
  }

  return (
    <div>
      <div className="summary">
        <div className="summary-row total">
          <span>Valor da inscrição</span>
          <span>{formatBRL(amountCents / 100)}</span>
        </div>
      </div>

      <h2>Como você quer pagar?</h2>
      <div className="row-2">
        <button
          type="button"
          className={method === 'credit_card' ? 'primary' : 'secondary'}
          onClick={() => setMethod('credit_card')}
        >
          Cartão de crédito
        </button>
        <button
          type="button"
          className={method === 'pix' ? 'primary' : 'secondary'}
          onClick={() => setMethod('pix')}
        >
          PIX
        </button>
      </div>

      {error != null && (
        <p className="error-msg">
          {getErrorMessage(error, 'Não foi possível processar o pagamento.')}
        </p>
      )}

      {method === 'credit_card' && (
        <EventCardForm
          submitting={submitting}
          onSubmit={({ cardToken }) => onPay({ method: 'credit_card', cardToken })}
        />
      )}

      {method === 'pix' && (
        <button
          className="primary"
          type="button"
          disabled={submitting}
          onClick={() => onPay({ method: 'pix' })}
        >
          {submitting ? 'Gerando PIX...' : 'Gerar PIX'}
        </button>
      )}
    </div>
  );
}
