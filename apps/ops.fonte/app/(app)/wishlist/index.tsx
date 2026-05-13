import { useAuth } from '@/lib/auth';
import { TimeLimitedScreen } from '@/components/TimeLimitedScreen';
import { WishlistPage } from '@/features/wishlist/pages/WishlistPage';

export default function WishlistScreen() {
  const { isResident } = useAuth();

  if (isResident) {
    return (
      <TimeLimitedScreen>
        <WishlistPage />
      </TimeLimitedScreen>
    );
  }

  return <WishlistPage />;
}
