import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

const mockReplace = jest.fn();
const mockSubmit = jest.fn();

jest.mock('expo-router', () => ({
  router: { replace: (...a: unknown[]) => mockReplace(...a) },
}));
jest.mock('@/lib/auth', () => ({
  useAuth: () => ({ staff: { houseId: 'h1', house: { name: 'Casa Teste' } } }),
}));
jest.mock('@/features/activities/hooks/useActivities', () => ({
  useCreateActivity: () => ({ isPending: false }),
}));
jest.mock('@/lib/offline/fieldSubmit', () => ({
  useFieldSubmit: () => mockSubmit,
}));

import { NewActivityPage } from './NewActivityPage';

type Callbacks = { onSent: () => void; onQueued: () => void; onFailed: () => void };

async function submitForm(): Promise<Callbacks> {
  render(<NewActivityPage />);
  fireEvent.changeText(screen.getByPlaceholderText('Ex: Consertar o portão'), 'Trocar lâmpada');
  fireEvent.press(screen.getByText('Criar rascunho'));
  await waitFor(() => expect(mockSubmit).toHaveBeenCalled());
  expect(mockSubmit.mock.calls[0][0]).toEqual({
    title: 'Trocar lâmpada',
    description: null,
    houseId: 'h1',
  });
  return mockSubmit.mock.calls[0][1];
}

const DRAFTS = { pathname: '/(app)/activities', params: { tab: 'DRAFT' } };

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

describe('NewActivityPage (story 220)', () => {
  it('onSent vai para a lista em Rascunhos e avisa', async () => {
    const cb = await submitForm();
    cb.onSent();
    expect(mockReplace).toHaveBeenCalledWith(DRAFTS);
    expect(Alert.alert).toHaveBeenCalledWith('Sucesso', 'Rascunho criado.');
  });

  it('onQueued também vai para Rascunhos e avisa que está no aparelho', async () => {
    const cb = await submitForm();
    cb.onQueued();
    expect(mockReplace).toHaveBeenCalledWith(DRAFTS);
    expect(Alert.alert).toHaveBeenCalledWith('Salvo no aparelho', expect.any(String));
  });

  it('onFailed não navega e mostra o erro', async () => {
    const cb = await submitForm();
    cb.onFailed();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith('Erro', 'Não foi possível criar a atividade.');
  });

  it('título vazio não envia', async () => {
    render(<NewActivityPage />);
    fireEvent.press(screen.getByText('Criar rascunho'));
    await waitFor(() => expect(screen.getByText('Informe o título')).toBeTruthy());
    expect(mockSubmit).not.toHaveBeenCalled();
  });
});
