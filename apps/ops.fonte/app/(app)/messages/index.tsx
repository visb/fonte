import { useAuth } from '@/lib/auth';
import { TimeLimitedScreen } from '@/components/TimeLimitedScreen';
import { MessagesPage } from '@/features/messages/pages/MessagesPage';

export default function MessagesScreen() {
  const { isResident } = useAuth();

  if (isResident) {
    return (
      <TimeLimitedScreen>
        <MessagesPage />
      </TimeLimitedScreen>
    );
  }

  return <MessagesPage />;
}
