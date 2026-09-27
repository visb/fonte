import { act, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { renderHookWithClient } from '@/lib/test/utils';
import { useProductContributionForm } from './useProductContributionForm';
import { api } from '@/lib/api';
import { useIsOnline } from '@/lib/offline/network';
jest.mock('@/lib/api', () => ({ api: { residents: { declareProductContributions: jest.fn() } } }));
jest.mock('@/lib/offline/network', () => ({ useIsOnline: jest.fn(() => true) }));
jest.mock('expo-router', () => ({ router: { replace: jest.fn(), back: jest.fn() } }));
const receivable = { id: 'rc', referenceMonth: '2026-09-01' };
beforeEach(() => { jest.clearAllMocks(); (useIsOnline as jest.Mock).mockReturnValue(true); jest.spyOn(Alert, 'alert').mockImplementation(() => {}); });
async function fillAndSubmit(result: { current: ReturnType<typeof useProductContributionForm> }) {
  act(() => result.current.setValue('products', [{ mode: 'avulso', description: 'Cesta', quantity: '', unit: '', inventoryItemId: '' }]));
  await act(async () => { await result.current.onSubmit(); });
}
it('online sends all serializable context then navigates to queue', async () => {
  (api.residents.declareProductContributions as jest.Mock).mockResolvedValue([]);
  const { result } = renderHookWithClient(() => useProductContributionForm('r', 'h', receivable, 'contributions'));
  await fillAndSubmit(result);
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith({ pathname: '/(app)/contributions', params: { successMsg: 'Contribuição em produtos declarada.' } }));
  expect(api.residents.declareProductContributions).toHaveBeenCalledWith('r', 'rc', { lines: [{ description: 'Cesta' }] }, { idempotencyKey: expect.any(String) });
});
it('offline immediately leaves with queued notice, without waiting for response', async () => {
  (useIsOnline as jest.Mock).mockReturnValue(false);
  (api.residents.declareProductContributions as jest.Mock).mockReturnValue(new Promise(() => {}));
  const { result } = renderHookWithClient(() => useProductContributionForm('r', 'h', receivable, 'contributions'));
  await fillAndSubmit(result);
  expect(router.replace).toHaveBeenCalledWith({ pathname: '/(app)/contributions', params: { successMsg: 'Contribuição salva no aparelho. Aguardando envio.' } });
});
it('existing resident entry returns to detail and shows success', async () => {
  (api.residents.declareProductContributions as jest.Mock).mockResolvedValue([]);
  const { result } = renderHookWithClient(() => useProductContributionForm('r', 'h', receivable));
  await fillAndSubmit(result);
  await waitFor(() => expect(router.back).toHaveBeenCalled());
  expect(Alert.alert).toHaveBeenCalledWith('Contribuição em produtos', 'Contribuição em produtos declarada.');
});
it('server error stays in form; missing receivable does not submit', async () => {
  (api.residents.declareProductContributions as jest.Mock).mockRejectedValue(new Error('falha'));
  const { result } = renderHookWithClient(() => useProductContributionForm('r', 'h', receivable));
  await fillAndSubmit(result);
  await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Erro', expect.any(String)));
  expect(router.back).not.toHaveBeenCalled();
  const missing = renderHookWithClient(() => useProductContributionForm('r', 'h', null));
  await fillAndSubmit(missing.result);
  expect(api.residents.declareProductContributions).toHaveBeenCalledTimes(1);
});
