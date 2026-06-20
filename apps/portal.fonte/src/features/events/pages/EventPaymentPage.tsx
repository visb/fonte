import { useParams } from 'react-router-dom';
import { EventPaymentStatus, type PayEventInput } from '@fonte/types';
import { BrandHeader } from '@/components/BrandHeader';
import { LoadingState, MessageScreen } from '@/components/StateScreens';
import { useEventPaymentByToken, usePayEvent } from '../hooks/useEventPayment';
import { EventPaymentChoice } from '../components/EventPaymentChoice';

/**
 * Página pública de pagamento da inscrição em evento (story 70). Rota
 * `/pagamento/:token`, reabrível até o pagamento ser confirmado. Orquestra os
 * estados PENDING (escolha de método), PAID (confirmação) e FAILED (erro + nova
 * tentativa); sem fetch direto (hooks).
 */
export function EventPaymentPage() {
  const { token } = useParams<{ token: string }>();
  const { data, isLoading, isError } = useEventPaymentByToken(token);
  const pay = usePayEvent(token ?? '');

  if (isLoading) return <LoadingState message="Carregando seu pagamento..." />;

  if (isError || !data) {
    return (
      <MessageScreen
        emoji="⚠️"
        title="Link inválido ou expirado"
        message="Não conseguimos abrir esta página de pagamento. Solicite um novo link à Fonte de Misericórdia."
      />
    );
  }

  if (data.paymentStatus === EventPaymentStatus.PAID) {
    return (
      <MessageScreen
        emoji="✅"
        title="Pagamento confirmado"
        message={`Obrigado, ${data.registrantName}! Sua inscrição em "${data.eventTitle}" está paga e confirmada. Até lá!`}
      />
    );
  }

  if (data.paymentStatus === EventPaymentStatus.NONE) {
    return (
      <MessageScreen
        emoji="💙"
        title="Inscrição sem pagamento"
        message={`${data.registrantName}, sua inscrição em "${data.eventTitle}" não requer pagamento.`}
      />
    );
  }

  const handlePay = (input: PayEventInput) => pay.mutate(input);

  return (
    <div className="page">
      <BrandHeader />
      <div className="card">
        <h1>{data.eventTitle}</h1>
        <p className="hint" style={{ marginTop: 0 }}>
          Olá, {data.registrantName}! Conclua o pagamento da sua inscrição.
        </p>
        {data.paymentStatus === EventPaymentStatus.FAILED && !pay.isSuccess && (
          <p className="error-msg">
            O pagamento anterior não foi concluído. Você pode tentar novamente abaixo.
          </p>
        )}
        <EventPaymentChoice
          amountCents={data.amountCents}
          submitting={pay.isPending}
          error={pay.error}
          result={pay.data}
          onPay={handlePay}
        />
      </div>
    </div>
  );
}
