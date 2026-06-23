import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '@/lib/test/utils';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('@/components/DatePickerModal', () => ({ DatePickerModal: () => null }));
jest.mock('react-native-qrcode-svg', () => () => null);
jest.mock('qrcode', () => ({ toString: jest.fn() }));
jest.mock('expo-file-system', () => ({ cacheDirectory: '/tmp/', writeAsStringAsync: jest.fn(), EncodingType: { UTF8: 'utf8' } }));
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn() }));
jest.mock('@/lib/api', () => ({ api: { supportGroups: { list: jest.fn(), createMeeting: jest.fn() } } }));

import { api } from '@/lib/api';
import { MeetingCard } from './MeetingCard';
import { CheckinRow } from './CheckinRow';
import { CreateMeetingModal } from './CreateMeetingModal';
import { QRCodeModal } from './QRCodeModal';

const m = api as unknown as { supportGroups: Record<string, jest.Mock> };

function rc(ui: React.ReactElement) {
  return render(<QueryClientProvider client={createTestQueryClient()}>{ui}</QueryClientProvider>);
}

beforeEach(() => jest.clearAllMocks());

describe('MeetingCard', () => {
  it('reunião de hoje mostra "HOJE" e contagem (singular)', () => {
    const today = new Date().toISOString().split('T')[0];
    render(<MeetingCard meeting={{ id: 'mt1', supportGroupName: 'Grupo A', date: today, notes: null, checkinCount: 1 } as never} />);
    expect(screen.getByText('HOJE')).toBeTruthy();
    expect(screen.getByText('1 família presente')).toBeTruthy();
  });

  it('reunião passada mostra contagem plural e navega ao tocar', () => {
    render(<MeetingCard meeting={{ id: 'mt2', supportGroupName: 'Grupo B', date: '2020-01-01', notes: 'tema especial', checkinCount: 5 } as never} />);
    expect(screen.queryByText('HOJE')).toBeNull();
    expect(screen.getByText('5 famílias presentes')).toBeTruthy();
    expect(screen.getByText('tema especial')).toBeTruthy();
    fireEvent.press(screen.getByText('Grupo B'));
    expect(mockPush).toHaveBeenCalledWith('/(app)/support-groups/mt2');
  });
});

describe('CheckinRow', () => {
  it('mostra residente e remove dispara onRemove', () => {
    const onRemove = jest.fn();
    render(<CheckinRow checkin={{ id: 'ck1', residentName: 'João', checkedInAt: '2026-06-23T14:30:00Z' } as never} onRemove={onRemove} isRemoving={false} />);
    expect(screen.getByText('João')).toBeTruthy();
    fireEvent.press(screen.getByText('icon:trash-outline'));
    expect(onRemove).toHaveBeenCalledWith('ck1');
  });
});

describe('CreateMeetingModal', () => {
  const props = { visible: true, onClose: jest.fn(), onSuccess: jest.fn() };

  it('sem grupos mostra aviso', async () => {
    m.supportGroups.list.mockResolvedValue([]);
    rc(<CreateMeetingModal {...props} />);
    await waitFor(() => expect(screen.getByText('Nenhum grupo cadastrado.')).toBeTruthy());
  });

  it('lista grupos e seleciona um', async () => {
    m.supportGroups.list.mockResolvedValue([
      { id: 'g1', name: 'Grupo A', dayOfWeek: 1, churchName: 'Igreja X' },
    ]);
    rc(<CreateMeetingModal {...props} />);
    await waitFor(() => expect(screen.getByText('Grupo A')).toBeTruthy());
    fireEvent.press(screen.getByText('Grupo A'));
    // o botão Criar fica disponível
    expect(screen.getByText('Criar')).toBeTruthy();
  });
});

describe('QRCodeModal', () => {
  it('mostra o nome do grupo, a data e a instrução de checkin', () => {
    render(<QRCodeModal visible onClose={jest.fn()} meetingId="mt1" groupName="Grupo A" date="2026-06-23" />);
    expect(screen.getByText('Grupo A')).toBeTruthy();
    expect(screen.getByText('23/06/2026')).toBeTruthy();
    expect(screen.getByText(/Mostre este QR Code/)).toBeTruthy();
  });

  it('fechar dispara onClose', () => {
    const onClose = jest.fn();
    render(<QRCodeModal visible onClose={onClose} meetingId="mt1" groupName="Grupo A" date="2026-06-23" />);
    fireEvent.press(screen.getByText('Fechar'));
    expect(onClose).toHaveBeenCalled();
  });
});
