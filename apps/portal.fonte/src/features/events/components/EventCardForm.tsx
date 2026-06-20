import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cardTokenizer } from '@/lib/cardTokenizer';
import { getErrorMessage } from '@/lib/errors';

const schema = z.object({
  cardNumber: z.string().min(13, 'Número do cartão inválido').max(23, 'Número do cartão inválido'),
  holderName: z.string().min(2, 'Informe o nome impresso no cartão'),
  expMonth: z.string().regex(/^(0[1-9]|1[0-2])$/, 'MM'),
  expYear: z.string().regex(/^\d{2}$/, 'AA'),
  cvv: z.string().regex(/^\d{3,4}$/, 'CVV inválido'),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  submitting: boolean;
  onSubmit: (data: { cardToken: string }) => void;
}

/**
 * Formulário de cartão da página de pagamento de evento (story 70). Tokeniza o
 * cartão client-side (Pagar.me); o PAN nunca passa pelo nosso backend. Envia só o
 * `cardToken`.
 */
export function EventCardForm({ submitting, onSubmit }: Props) {
  const [tokenizing, setTokenizing] = useState(false);
  const [tokenizeError, setTokenizeError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { cardNumber: '', holderName: '', expMonth: '', expYear: '', cvv: '' },
  });

  const submit = handleSubmit(async (values) => {
    setTokenizeError(null);
    setTokenizing(true);
    try {
      const cardToken = await cardTokenizer.tokenize({
        number: values.cardNumber,
        holderName: values.holderName,
        expMonth: values.expMonth,
        expYear: values.expYear,
        cvv: values.cvv,
      });
      onSubmit({ cardToken });
    } catch (err) {
      setTokenizeError(getErrorMessage(err, 'Não foi possível validar o cartão.'));
    } finally {
      setTokenizing(false);
    }
  });

  const busy = tokenizing || submitting;

  return (
    <form onSubmit={submit} noValidate>
      <div className="field">
        <label htmlFor="cardNumber">Número do cartão</label>
        <input
          id="cardNumber"
          inputMode="numeric"
          autoComplete="cc-number"
          placeholder="0000 0000 0000 0000"
          {...register('cardNumber')}
        />
        {errors.cardNumber && <p className="error-msg">{errors.cardNumber.message}</p>}
      </div>

      <div className="field">
        <label htmlFor="holderName">Nome impresso no cartão</label>
        <input id="holderName" autoComplete="cc-name" {...register('holderName')} />
        {errors.holderName && <p className="error-msg">{errors.holderName.message}</p>}
      </div>

      <div className="row-2">
        <div className="field">
          <label htmlFor="expMonth">Mês (MM)</label>
          <input id="expMonth" inputMode="numeric" autoComplete="cc-exp-month" placeholder="MM" {...register('expMonth')} />
          {errors.expMonth && <p className="error-msg">{errors.expMonth.message}</p>}
        </div>
        <div className="field">
          <label htmlFor="expYear">Ano (AA)</label>
          <input id="expYear" inputMode="numeric" autoComplete="cc-exp-year" placeholder="AA" {...register('expYear')} />
          {errors.expYear && <p className="error-msg">{errors.expYear.message}</p>}
        </div>
        <div className="field">
          <label htmlFor="cvv">CVV</label>
          <input id="cvv" inputMode="numeric" autoComplete="cc-csc" placeholder="123" {...register('cvv')} />
          {errors.cvv && <p className="error-msg">{errors.cvv.message}</p>}
        </div>
      </div>

      {tokenizeError && <p className="error-msg">{tokenizeError}</p>}

      <button className="primary" type="submit" disabled={busy}>
        {busy ? 'Processando...' : 'Pagar com cartão'}
      </button>

      {cardTokenizer.mode === 'stub' && (
        <span className="badge-stub">
          Modo desenvolvimento: cartão não é cobrado de verdade (tokenização stub)
        </span>
      )}

      <p className="hint">
        Seus dados de cartão são tokenizados com segurança pela Pagar.me e nunca
        passam pelos servidores da Fonte.
      </p>
    </form>
  );
}
