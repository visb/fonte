import { useParams } from 'react-router-dom';
import { BrandHeader } from '@/components/BrandHeader';
import { LoadingState, MessageScreen } from '@/components/StateScreens';
import { getErrorMessage } from '@/lib/errors';
import {
  useAssociateCancelView,
  useCancelByToken,
} from '../hooks/useAssociateCancel';

/**
 * Página pública de autocancelamento da assinatura (story 45). Aberta pelo link
 * do 3º+ lembrete de WhatsApp: `/cancelar/:token`. Mostra o nome do associado e
 * um botão de confirmação (sem cancelamento por 1 clique). Idempotente: já
 * cancelado → mesma tela de sucesso.
 */
export function CancelPage() {
  const { token } = useParams<{ token: string }>();
  const { data, isLoading, isError } = useAssociateCancelView(token);
  const cancel = useCancelByToken(token ?? '');

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

  if (cancel.isSuccess) {
    return (
      <MessageScreen
        emoji="✅"
        title="Assinatura cancelada"
        message={`${data.name}, sua contribuição mensal foi cancelada. Você pode voltar a contribuir quando quiser. Que Deus o abençoe.`}
      />
    );
  }

  // Sem assinatura ativa/cancelável: já está cancelada — trata como sucesso.
  if (!data.hasActiveSubscription) {
    return (
      <MessageScreen
        emoji="✅"
        title="Assinatura cancelada"
        message={`${data.name}, você não possui contribuição mensal ativa. Nada será cobrado.`}
      />
    );
  }

  return (
    <div className="page">
      <BrandHeader />
      <div className="card">
        <h2>Olá, {data.name}</h2>
        <p className="hint" style={{ marginTop: 0 }}>
          Você está prestes a cancelar sua contribuição mensal recorrente à Fonte
          de Misericórdia. Após confirmar, nenhuma cobrança será feita.
        </p>
        {cancel.isError && (
          <p className="error-msg">
            {getErrorMessage(
              cancel.error,
              'Não foi possível cancelar agora. Tente novamente.',
            )}
          </p>
        )}
        <button
          className="primary"
          type="button"
          disabled={cancel.isPending}
          onClick={() => cancel.mutate()}
        >
          {cancel.isPending ? 'Cancelando...' : 'Confirmar cancelamento'}
        </button>
      </div>
    </div>
  );
}
