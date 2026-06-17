import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PaymentPage } from '@/features/payment/pages/PaymentPage';
import { InvalidLinkPage } from '@/features/payment/pages/InvalidLinkPage';
import { CancelPage } from '@/features/cancel/pages/CancelPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Link enviado pelo WhatsApp ([[39]]): /p/:token */}
          <Route path="/p/:token" element={<PaymentPage />} />
          {/* Autocancelamento da assinatura ([[45]]): /cancelar/:token */}
          <Route path="/cancelar/:token" element={<CancelPage />} />
          {/* Atalho: /:token também resolve a página de pagamento. */}
          <Route path="/:token" element={<PaymentPage />} />
          <Route path="/" element={<InvalidLinkPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
