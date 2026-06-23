import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

const mockMutate = jest.fn();
jest.mock('../hooks/useProfile', () => ({
  useUpdateProfile: () => ({ mutate: mockMutate, isPending: false }),
}));

import { ProfileDataForm } from './ProfileDataForm';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ProfileDataForm', () => {
  it('preenche os campos com os defaultValues', () => {
    render(
      <ProfileDataForm
        defaultValues={{ name: 'Maria', phone: '11999998888' }}
        onSuccess={jest.fn()}
      />,
    );
    expect(screen.getByLabelText('input-nome').props.value).toBe('Maria');
  });

  it('bloqueia submit com nome vazio', async () => {
    render(<ProfileDataForm defaultValues={{ name: '', phone: '' }} onSuccess={jest.fn()} />);
    fireEvent.press(screen.getByText('Salvar dados'));

    expect(await screen.findByText('Nome é obrigatório')).toBeOnTheScreen();
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('envia name + phone (phone vazio vira null) e mostra sucesso', async () => {
    mockMutate.mockImplementation((_data, { onSuccess }) => onSuccess());
    const onSuccess = jest.fn();
    render(<ProfileDataForm defaultValues={{ name: 'Maria', phone: '' }} onSuccess={onSuccess} />);

    fireEvent.press(screen.getByText('Salvar dados'));

    await waitFor(() => expect(mockMutate).toHaveBeenCalled());
    expect(mockMutate.mock.calls[0][0]).toEqual({ name: 'Maria', phone: null });
    expect(onSuccess).toHaveBeenCalled();
    expect(await screen.findByLabelText('profile-save-success')).toBeOnTheScreen();
  });

  it('mostra erro quando a mutation falha', async () => {
    mockMutate.mockImplementation((_data, { onError }) =>
      onError({ response: { data: { message: 'Telefone inválido' } } }),
    );
    render(<ProfileDataForm defaultValues={{ name: 'Maria', phone: '' }} onSuccess={jest.fn()} />);

    fireEvent.press(screen.getByText('Salvar dados'));

    expect(await screen.findByText('Telefone inválido')).toBeOnTheScreen();
  });
});
