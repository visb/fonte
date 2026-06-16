import { useParams } from 'react-router-dom';
import { AssociateStatus } from '@fonte/types';
import { BrandHeader } from '@/components/BrandHeader';
import { LoadingState, MessageScreen } from '@/components/StateScreens';
import { getErrorMessage } from '@/lib/errors';
import { useAssociatePublic, useSubscribe } from '../hooks/useAssociatePublic';
import { SubscribeForm } from '../components/SubscribeForm';

export function PaymentPage() {
  const { token } = useParams<{ token: string }>();
  const { data, isLoading, isError } = useAssociatePublic(token);
  const subscribe = useSubscribe(token ?? '');

  if (isLoading) return <LoadingState message="Carregando seus dados..." />;

  if (isError || !data) {
    return (
      <MessageScreen
        emoji="⚠️"
        title="Link inválido ou expirado"
        message="Não conseguimos abrir esta página. Solicite um novo link à Fonte de Misericórdia."
      />
    );
  }

  if (subscribe.isSuccess) {
    return (
      <MessageScreen
        emoji="✅"
        title="Contribuição mensal ativada"
        message={`Obrigado, ${data.name}! Sua contribuição recorrente foi ativada. Que Deus o abençoe.`}
      />
    );
  }

  if (data.hasActiveSubscription || data.status === AssociateStatus.ACTIVE) {
    return (
      <MessageScreen
        emoji="💙"
        title="Você já contribui conosco"
        message={`${data.name}, sua contribuição mensal já está ativa. Obrigado pelo seu apoio!`}
      />
    );
  }

  return (
    <div className="page">
      <BrandHeader />
      <div className="card">
        <h2>Olá, {data.name}!</h2>
        <p className="hint" style={{ marginTop: 0 }}>
          Ative sua contribuição mensal recorrente com cartão de crédito. O valor
          abaixo é debitado automaticamente todo mês.
        </p>
        {subscribe.isError && (
          <p className="error-msg">
            {getErrorMessage(
              subscribe.error,
              'Não foi possível ativar a contribuição. Tente novamente.',
            )}
          </p>
        )}
        <SubscribeForm
          amount={data.suggestedAmount}
          submitting={subscribe.isPending}
          onSubmit={(values) => subscribe.mutate(values)}
        />
      </div>
    </div>
  );
}
