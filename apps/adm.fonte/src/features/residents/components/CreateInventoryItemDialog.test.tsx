import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FamilyInvestment } from '@fonte/types';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { CreateInventoryItemDialog } from './CreateInventoryItemDialog';
import { RegisterPaymentDialog } from './RegisterPaymentDialog';

vi.mock('@/lib/api', () => ({ api: {
  storeroom: { createItem: vi.fn(), listItems: vi.fn() }, supplyRoom: { createItem: vi.fn(), listItems: vi.fn() },
  residents: { declareProductContributions: vi.fn(), registerReceivablePayment: vi.fn() },
} }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const wrap = (node: React.ReactNode) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>{node}</QueryClientProvider>);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.storeroom.listItems).mockResolvedValue([]);
  vi.mocked(api.supplyRoom.listItems).mockResolvedValue([]);
  vi.mocked(api.storeroom.createItem).mockResolvedValue({ id: 'created', name: 'Arroz', unit: 'kg' } as never);
  vi.mocked(api.supplyRoom.createItem).mockResolvedValue({ id: 'created', name: 'Sabão', unit: 'barra' } as never);
});
afterEach(cleanup);
it('validates name/unit/category and strips category when returning to Dispensa', async () => {
  const created = vi.fn(), close = vi.fn();
  wrap(<CreateInventoryItemDialog name="" houseId="house" onClose={close} onCreated={created} />);
  fireEvent.click(screen.getByText('Cadastrar produto'));
  expect(await screen.findByText('Informe o nome')).toBeInTheDocument();
  expect(screen.getByText('Informe a unidade')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Nome do produto'), { target: { value: ' Arroz ' } });
  fireEvent.change(screen.getByLabelText('Unidade do produto'), { target: { value: ' kg ' } });
  fireEvent.change(screen.getByLabelText('Destino'), { target: { value: 'supply' } });
  fireEvent.click(screen.getByText('Cadastrar produto'));
  await waitFor(() => expect(api.supplyRoom.createItem).not.toHaveBeenCalled());
  fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: 'CLEANING' } });
  fireEvent.change(screen.getByLabelText('Destino'), { target: { value: 'storeroom' } });
  expect(screen.queryByLabelText('Categoria')).toBeNull();
  fireEvent.click(screen.getByText('Cadastrar produto'));
  await waitFor(() => expect(api.storeroom.createItem).toHaveBeenCalledWith({ name: 'Arroz', unit: 'kg', houseId: 'house' }));
  expect(created).toHaveBeenCalledWith(expect.objectContaining({ id: 'created' }));
  expect(close).toHaveBeenCalled();
});
it('routes Almoxarifado with category and shows backend rejection', async () => {
  vi.mocked(api.supplyRoom.createItem).mockRejectedValue({ response: { data: { message: 'Produto duplicado' } } });
  const close = vi.fn();
  wrap(<CreateInventoryItemDialog name="Sabão" houseId="house" onClose={close} onCreated={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Unidade do produto'), { target: { value: 'barra' } });
  fireEvent.change(screen.getByLabelText('Destino'), { target: { value: 'supply' } });
  fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: 'CLEANING' } });
  fireEvent.click(screen.getByText('Cadastrar produto'));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Produto duplicado'));
  expect(api.supplyRoom.createItem).toHaveBeenCalledWith({ name: 'Sabão', unit: 'barra', category: 'CLEANING', houseId: 'house' });
  expect(close).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Cancelar cadastro'));
  expect(close).toHaveBeenCalled();
});
it('creates inside payment dialog, selects new product, returns focus and preserves amount without submitting payment', async () => {
  vi.mocked(api.storeroom.createItem).mockImplementation(async () => {
    const item = { id: 'created', name: 'Arroz', unit: 'kg' };
    vi.mocked(api.storeroom.listItems).mockResolvedValue([item] as never);
    return item as never;
  });
  const close = vi.fn();
  wrap(<RegisterPaymentDialog open onClose={close} residentId="resident" residentName="Filho" houseId="house"
    receivable={{ id: 'rc', amount: 700, familyInvestment: FamilyInvestment.PAYMENT_700, referenceMonth: '2026-09-01' } as never} />);
  const amount = screen.getAllByRole('spinbutton')[0];
  fireEvent.change(amount, { target: { value: '321' } });
  fireEvent.click(screen.getByText('Adicionar produto'));
  fireEvent.change(screen.getByLabelText('Buscar produto'), { target: { value: 'Arroz' } });
  fireEvent.click(await screen.findByText('Cadastrar «Arroz»'));
  fireEvent.change(screen.getByLabelText('Unidade do produto'), { target: { value: 'kg' } });
  fireEvent.click(screen.getByText('Cadastrar produto'));
  await waitFor(() => expect(screen.queryByText('Novo produto')).toBeNull());
  expect(screen.getByText('Registrar contribuição')).toBeInTheDocument();
  expect(screen.getByLabelText('Produto do catálogo')).toHaveValue('created');
  expect(amount).toHaveValue(321);
  await waitFor(() => expect(screen.getByLabelText('Buscar produto')).toHaveFocus());
  expect(close).not.toHaveBeenCalled();
  expect(api.residents.registerReceivablePayment).not.toHaveBeenCalled();
  expect(api.residents.declareProductContributions).not.toHaveBeenCalled();
});
