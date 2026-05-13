import { useAuth } from '@/lib/auth';
import { TimeLimitedScreen } from '@/components/TimeLimitedScreen';
import { ConversationPage } from '@/features/messages/pages/ConversationPage';

export default function ConversationScreen() {
  const { isResident } = useAuth();

  if (isResident) {
    return (
      <TimeLimitedScreen>
        <ConversationPage />
      </TimeLimitedScreen>
    );
  }

  return <ConversationPage />;
}
