import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '@/lib/test/utils';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});

jest.mock('@/lib/api', () => ({
  api: {
    residents: { update: jest.fn(), getAttachments: jest.fn() },
    houses: { listMinistries: jest.fn() },
    consents: { status: jest.fn(), grant: jest.fn(), revoke: jest.fn() },
  },
  resolveAssetUrl: (u: string) => u,
}));

import { api } from '@/lib/api';
import { ChangeMinistryModal } from './ChangeMinistryModal';
import { ResidentAttachmentsTab } from './ResidentAttachmentsTab';
import { ResidentPrivacyTab } from './ResidentPrivacyTab';

const m = api as unknown as {
  residents: Record<string, jest.Mock>;
  houses: Record<string, jest.Mock>;
  consents: Record<string, jest.Mock>;
};

function renderWithClient(ui: React.ReactElement) {
  return render(<QueryClientProvider client={createTestQueryClient()}>{ui}</QueryClientProvider>);
}

beforeEach(() => jest.clearAllMocks());

describe('ChangeMinistryModal', () => {
  const props = {
    visible: true,
    onClose: jest.fn(),
    residentId: 'r1',
    houseId: 'h1',
    currentMinistryId: null,
  };

  it('lista ministérios da casa + opção Nenhum', async () => {
    m.houses.listMinistries.mockResolvedValue([
      { id: 'min1', name: 'Cozinha' },
      { id: 'min2', name: 'Limpeza' },
    ]);
    renderWithClient(<ChangeMinistryModal {...props} />);
    await waitFor(() => expect(screen.getByText('Cozinha')).toBeTruthy());
    expect(screen.getByText('Nenhum')).toBeTruthy();
    expect(screen.getByText('Limpeza')).toBeTruthy();
  });

  it('confirmar sem mudança apenas fecha (não muta)', async () => {
    const onClose = jest.fn();
    m.houses.listMinistries.mockResolvedValue([]);
    renderWithClient(<ChangeMinistryModal {...props} onClose={onClose} />);
    await waitFor(() => expect(screen.getByText('Nenhum')).toBeTruthy());
    fireEvent.press(screen.getByText('Confirmar'));
    expect(m.residents.update).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('selecionar outro ministério e confirmar muta o residente', async () => {
    m.houses.listMinistries.mockResolvedValue([{ id: 'min1', name: 'Cozinha' }]);
    m.residents.update.mockResolvedValue({ id: 'r1' });
    renderWithClient(<ChangeMinistryModal {...props} />);
    await waitFor(() => expect(screen.getByText('Cozinha')).toBeTruthy());
    fireEvent.press(screen.getByText('Cozinha'));
    fireEvent.press(screen.getByText('Confirmar'));
    await waitFor(() =>
      expect(m.residents.update).toHaveBeenCalledWith('r1', { ministryId: 'min1' }),
    );
  });
});

describe('ResidentAttachmentsTab', () => {
  it('vazio mostra mensagem', async () => {
    m.residents.getAttachments.mockResolvedValue([]);
    renderWithClient(<ResidentAttachmentsTab residentId="r1" />);
    await waitFor(() => expect(screen.getByText('Nenhum anexo adicionado.')).toBeTruthy());
  });

  it('lista anexos e abre a URL ao tocar', async () => {
    jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
    m.residents.getAttachments.mockResolvedValue([
      { id: 'a1', filename: 'doc.pdf', fileUrl: 'https://x/doc.pdf', createdAt: '2026-01-01T00:00:00Z' },
    ]);
    renderWithClient(<ResidentAttachmentsTab residentId="r1" />);
    await waitFor(() => expect(screen.getByText('doc.pdf')).toBeTruthy());
    fireEvent.press(screen.getByText('doc.pdf'));
    expect(Linking.openURL).toHaveBeenCalledWith('https://x/doc.pdf');
  });
});

describe('ResidentPrivacyTab (LGPD)', () => {
  it('mostra os consentimentos e reflete o status concedido', async () => {
    m.consents.status.mockResolvedValue([{ purpose: 'IMAGE_PUBLICATION', granted: true }]);
    renderWithClient(<ResidentPrivacyTab residentId="r1" />);
    await waitFor(() => expect(screen.getByText('Uso de imagem')).toBeTruthy());
    expect(screen.getByText('Divulgação religiosa')).toBeTruthy();
  });

  it('togglar um consentimento dispara o toggle (concede o ausente)', async () => {
    m.consents.status.mockResolvedValue([]);
    m.consents.grant.mockResolvedValue({ ok: true });
    renderWithClient(<ResidentPrivacyTab residentId="r1" />);
    await waitFor(() => expect(screen.getByText('Uso de imagem')).toBeTruthy());
    const switches = screen.UNSAFE_getAllByType(require('react-native').Switch);
    fireEvent(switches[0], 'valueChange', true);
    await waitFor(() =>
      expect(m.consents.grant).toHaveBeenCalledWith(
        expect.objectContaining({ subjectType: 'RESIDENT', subjectId: 'r1', purpose: 'IMAGE_PUBLICATION' }),
      ),
    );
  });
});
