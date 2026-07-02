import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '@/lib/test/utils';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});
const mockChangePassword = jest.fn();
jest.mock('@/lib/auth', () => ({ useAuth: () => ({ changePassword: mockChangePassword }) }));
jest.mock('@/lib/api', () => ({ api: { staff: { updateMe: jest.fn() } } }));

import { api } from '@/lib/api';
import { ChangePasswordSection } from './ChangePasswordSection';
import { ProfileDataSection } from './ProfileDataSection';
import { ProfileHeader } from './ProfileHeader';

const m = api as unknown as { staff: Record<string, jest.Mock> };

function rc(ui: React.ReactElement) {
  return render(<QueryClientProvider client={createTestQueryClient()}>{ui}</QueryClientProvider>);
}

beforeEach(() => jest.clearAllMocks());

describe('ChangePasswordSection', () => {
  it('senha curta mostra erro de validação e não chama changePassword', async () => {
    rc(<ChangePasswordSection />);
    fireEvent.changeText(screen.getAllByPlaceholderText('••••••••')[0], '123');
    fireEvent.changeText(screen.getAllByPlaceholderText('••••••••')[1], '123');
    fireEvent.press(screen.getAllByText('Alterar senha')[1]);
    await waitFor(() => expect(screen.getByText('Mínimo 6 caracteres')).toBeTruthy());
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it('senhas diferentes mostram erro de confirmação', async () => {
    rc(<ChangePasswordSection />);
    fireEvent.changeText(screen.getAllByPlaceholderText('••••••••')[0], 'senha123');
    fireEvent.changeText(screen.getAllByPlaceholderText('••••••••')[1], 'outra123');
    fireEvent.press(screen.getAllByText('Alterar senha')[1]);
    await waitFor(() => expect(screen.getByText('As senhas não coincidem')).toBeTruthy());
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it('senha válida chama changePassword e mostra sucesso', async () => {
    mockChangePassword.mockResolvedValue(undefined);
    rc(<ChangePasswordSection />);
    fireEvent.changeText(screen.getAllByPlaceholderText('••••••••')[0], 'senha123');
    fireEvent.changeText(screen.getAllByPlaceholderText('••••••••')[1], 'senha123');
    fireEvent.press(screen.getAllByText('Alterar senha')[1]);
    await waitFor(() => expect(mockChangePassword).toHaveBeenCalledWith('senha123'));
    await waitFor(() => expect(screen.getByText('Senha alterada com sucesso!')).toBeTruthy());
  });
});

describe('ProfileDataSection', () => {
  // Story 97 — o telefone do servo virou whatsapp (campo e rótulo).
  const staff = { id: 's1', name: 'Servo X', whatsapp: '11999', user: { email: 'x@fonte.com' } } as never;

  it('preenche os dados atuais e salva (E-mail/WhatsApp)', async () => {
    m.staff.updateMe.mockResolvedValue({});
    const onRefresh = jest.fn();
    rc(<ProfileDataSection staff={staff} onRefresh={onRefresh} />);
    await waitFor(() => expect(screen.getByDisplayValue('Servo X')).toBeTruthy());
    expect(screen.getByText('WhatsApp')).toBeTruthy();
    fireEvent.press(screen.getByText('Salvar dados'));
    await waitFor(() =>
      expect(m.staff.updateMe).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Servo X', whatsapp: '11999', email: 'x@fonte.com' }),
      ),
    );
    expect(onRefresh).toHaveBeenCalled();
  });

  it('e-mail inválido mostra erro de validação', async () => {
    rc(<ProfileDataSection staff={staff} onRefresh={jest.fn()} />);
    await waitFor(() => expect(screen.getByDisplayValue('x@fonte.com')).toBeTruthy());
    fireEvent.changeText(screen.getByDisplayValue('x@fonte.com'), 'invalido');
    fireEvent.press(screen.getByText('Salvar dados'));
    await waitFor(() => expect(screen.getByText('E-mail inválido')).toBeTruthy());
    expect(m.staff.updateMe).not.toHaveBeenCalled();
  });
});

describe('ProfileHeader', () => {
  it('mostra nome, subtítulo e dispara onPickPhoto', () => {
    const onPickPhoto = jest.fn();
    render(<ProfileHeader displayName="Servo X" subtitle="Coordenador" photoUrl={null} isPhotoUploading={false} onPickPhoto={onPickPhoto} />);
    expect(screen.getByText('Servo X')).toBeTruthy();
    expect(screen.getByText('Coordenador')).toBeTruthy();
    expect(screen.getByText('icon:camera')).toBeTruthy();
    fireEvent.press(screen.getByText('icon:person'));
    expect(onPickPhoto).toHaveBeenCalled();
  });

  it('upload em andamento mostra o indicador (sem ícone de câmera)', () => {
    render(<ProfileHeader displayName="Servo X" photoUrl={null} isPhotoUploading onPickPhoto={jest.fn()} />);
    expect(screen.queryByText('icon:camera')).toBeNull();
  });
});
