import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '@/lib/test/utils';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: { Images: 'Images' },
}));
jest.mock('@/lib/api', () => ({
  api: { houses: { createCapacityRequest: jest.fn(), addPhoto: jest.fn(), deletePhoto: jest.fn() } },
  resolveAssetUrl: (u: string | null) => u,
}));

import { api } from '@/lib/api';
import { BedCapacityForm } from './BedCapacityForm';
import { HousePhotoItem } from './HousePhotoItem';
import { HousePhotoGallery } from './HousePhotoGallery';

const m = api as unknown as { houses: Record<string, jest.Mock> };

function rc(ui: React.ReactElement) {
  return render(<QueryClientProvider client={createTestQueryClient()}>{ui}</QueryClientProvider>);
}

beforeEach(() => jest.clearAllMocks());

describe('BedCapacityForm', () => {
  const house = { id: 'h1', generalCapacity: 10, staffCapacity: 4 } as never;

  it('preenche os defaults e envia o pedido de alteração', async () => {
    m.houses.createCapacityRequest.mockResolvedValue({ id: 'req1' });
    rc(<BedCapacityForm house={house} />);
    fireEvent.press(screen.getByText('Solicitar alteração'));
    await waitFor(() =>
      expect(m.houses.createCapacityRequest).toHaveBeenCalledWith('h1', {
        generalCapacity: 10,
        staffCapacity: 4,
      }),
    );
  });

  it('valor inválido (zero) mostra erro de validação', async () => {
    rc(<BedCapacityForm house={house} />);
    fireEvent.changeText(screen.getAllByPlaceholderText('0')[0], '0');
    fireEvent.press(screen.getByText('Solicitar alteração'));
    await waitFor(() => expect(screen.getByText('Mínimo 1 leito')).toBeTruthy());
    expect(m.houses.createCapacityRequest).not.toHaveBeenCalled();
  });
});

describe('HousePhotoItem', () => {
  it('remover abre o Alert de confirmação e confirma chama onRemove', () => {
    let confirm: (() => void) | undefined;
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      confirm = (buttons?.[1] as { onPress?: () => void })?.onPress;
    });
    const onRemove = jest.fn();
    render(<HousePhotoItem photo={{ id: 'p1', url: 'https://x/p.jpg' } as never} onRemove={onRemove} isRemoving={false} />);
    fireEvent.press(screen.getByText('icon:trash-outline'));
    expect(Alert.alert).toHaveBeenCalled();
    confirm?.();
    expect(onRemove).toHaveBeenCalledWith('p1');
  });
});

describe('HousePhotoGallery', () => {
  it('sem fotos mostra aviso e botão de adicionar', () => {
    rc(<HousePhotoGallery house={{ id: 'h1', photos: [] } as never} />);
    expect(screen.getByText('Nenhuma foto adicionada.')).toBeTruthy();
    expect(screen.getByText('Adicionar foto')).toBeTruthy();
  });

  it('com fotos renderiza a galeria', () => {
    rc(<HousePhotoGallery house={{ id: 'h1', photos: [{ id: 'p1', url: 'https://x/p.jpg' }] } as never} />);
    expect(screen.queryByText('Nenhuma foto adicionada.')).toBeNull();
    expect(screen.getByText('icon:trash-outline')).toBeTruthy();
  });
});
