import { MessageScreen } from '@/components/StateScreens';

export function InvalidLinkPage() {
  return (
    <MessageScreen
      emoji="🔗"
      title="Link inválido"
      message="Use o link de pagamento que você recebeu pelo WhatsApp da Fonte de Misericórdia."
    />
  );
}
