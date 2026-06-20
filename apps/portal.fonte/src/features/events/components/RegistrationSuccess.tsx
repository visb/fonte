import { useState } from 'react';
import { EventPaymentStatus, type EventRegistrationResult } from '@fonte/types';
import { BrandHeader } from '@/components/BrandHeader';

interface Props {
  result: EventRegistrationResult;
  eventTitle: string;
}

/**
 * Confirmação pós-inscrição (story 70). Para evento GRÁTIS, só confirma. Para
 * evento PAGO, mostra o link `/pagamento/:token` (copiável) e avisa que o link
 * também foi enviado por e-mail/WhatsApp.
 */
export function RegistrationSuccess({ result, eventTitle }: Props) {
  const [copied, setCopied] = useState(false);
  const isPaid =
    result.paymentStatus === EventPaymentStatus.PENDING && !!result.paymentToken;

  if (!isPaid) {
    return (
      <div className="page">
        <BrandHeader />
        <div className="card center">
          <div className="emoji">✅</div>
          <h2>Inscrição confirmada</h2>
          <p>Você está inscrito em "{eventTitle}". Até lá!</p>
        </div>
      </div>
    );
  }

  const link = `${window.location.origin}/pagamento/${result.paymentToken}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="page">
      <BrandHeader />
      <div className="card center">
        <div className="emoji">📝</div>
        <h2>Inscrição recebida</h2>
        <p>
          Falta concluir o pagamento da sua inscrição em "{eventTitle}".
          Use o link abaixo para pagar agora ou depois:
        </p>
        <div className="field">
          <a className="event-link" href={link}>
            {link}
          </a>
        </div>
        <button className="primary" type="button" onClick={copy}>
          {copied ? 'Link copiado!' : 'Copiar link de pagamento'}
        </button>
        <p className="hint">
          Também enviamos este link por e-mail e WhatsApp (quando informados).
        </p>
      </div>
    </div>
  );
}
