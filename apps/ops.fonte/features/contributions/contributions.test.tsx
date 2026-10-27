import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { renderHookWithClient } from '@/lib/test/utils';
import { ContributionsQueuePage } from './pages/ContributionsQueuePage';
import { PickResidentPage } from './pages/PickResidentPage';
import { useHouseProductContributions, currentContributionMonth } from './hooks/useHouseProductContributions';
import { api } from '@/lib/api';
jest.mock('@/lib/api', () => ({ api: { houses: { productContributions: jest.fn() }, residents: { listByHouse: jest.fn() } } }));
jest.mock('@/lib/auth', () => ({ useAuth: () => ({ staff: { houseId: 'h' } }) }));
jest.mock('@/lib/offline/store/useLastSyncedAt', () => ({ useLastSyncedAt: () => null }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), setParams: jest.fn() }, Stack: { Screen: () => null }, useLocalSearchParams: () => ({}) }));
import { renderWithClient } from '@/lib/test/utils';

const group = { residentId: 'r', residentName: 'Álvaro', receivableId: 'rc', referenceMonth: '2026-09-01', lines: [
  { id: '1', inventoryItemId: 'i', pendingDetailing: false },
  { id: 'outbox:2', description: 'Cesta básica', pendingDetailing: true },
] };
beforeEach(() => { jest.clearAllMocks(); });
it('month uses local components and query fetches house/month', async () => {
  expect(currentContributionMonth(new Date(2026, 8, 1))).toBe('2026-09-01');
  (api.houses.productContributions as jest.Mock).mockResolvedValue([group]);
  const { result } = renderHookWithClient(() => useHouseProductContributions('h', '2026-09-01'));
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(api.houses.productContributions).toHaveBeenCalledWith('h', { referenceMonth: '2026-09-01' });
  expect(result.current.data).toEqual([group]);
});
it('disabled when house is absent', () => {
  renderHookWithClient(() => useHouseProductContributions(null));
  expect(api.houses.productContributions).not.toHaveBeenCalled();
});
it('queue renders one row per resident with catalog/free-text/pending summaries and navigation', async () => {
  (api.houses.productContributions as jest.Mock).mockResolvedValue([group, { ...group, residentId: 'r2', receivableId: 'rc2', residentName: 'Zé', lines: [{ id: '3', inventoryItemId: 'i' }, { id: '4', inventoryItemId: 'i' }] }]);
  const screen = renderWithClient(<ContributionsQueuePage />);
  await screen.findByText('Álvaro');
  expect(screen.getByText('1 item do catálogo')).toBeTruthy();
  expect(screen.getByText('2 itens do catálogo')).toBeTruthy();
  expect(screen.getByText('Cesta básica')).toBeTruthy();
  expect(screen.getByText('Aguardando envio')).toBeTruthy();
  expect(screen.getByText('Pendente de detalhamento')).toBeTruthy();
  fireEvent.press(screen.getByText('Nova contribuição'));
  expect(router.push).toHaveBeenCalledWith('/(app)/contributions/pick-resident');
});
it('queue handles empty/error/retry', async () => {
  (api.houses.productContributions as jest.Mock).mockRejectedValue(new Error('falha'));
  const screen = renderWithClient(<ContributionsQueuePage />);
  await screen.findByText('Erro ao carregar contribuições.');
  (api.houses.productContributions as jest.Mock).mockResolvedValue([]);
  fireEvent.press(screen.getByText('Tentar novamente'));
  await screen.findByText('Nenhuma contribuição declarada neste mês.');
});
it('picker loads house residents, searches accents and navigates with both ids', async () => {
  (api.residents.listByHouse as jest.Mock).mockResolvedValue([{ id: 'r', name: 'Álvaro' }, { id: 'r2', name: 'Zé' }]);
  const screen = renderWithClient(<PickResidentPage />);
  await screen.findByText('Álvaro');
  expect(api.residents.listByHouse).toHaveBeenCalledWith('h');
  fireEvent.changeText(screen.getByLabelText('Buscar filho'), 'alvaro');
  expect(screen.queryByText('Zé')).toBeNull();
  fireEvent.press(screen.getByText('Álvaro'));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/(app)/residents/declare-products', params: { residentId: 'r', houseId: 'h', returnTo: 'contributions' } });
  fireEvent.changeText(screen.getByLabelText('Buscar filho'), 'nobody');
  expect(screen.getByText('Nenhum filho encontrado.')).toBeTruthy();
});
it('picker handles error and retry', async () => {
  (api.residents.listByHouse as jest.Mock).mockRejectedValue(new Error('falha'));
  const screen = renderWithClient(<PickResidentPage />);
  await screen.findByText('Erro ao carregar filhos.');
  (api.residents.listByHouse as jest.Mock).mockResolvedValue([]);
  fireEvent.press(screen.getByText('Tentar novamente'));
  await screen.findByText('Nenhum filho encontrado.');
});
