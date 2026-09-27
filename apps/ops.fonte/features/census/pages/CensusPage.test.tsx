/**
 * Contagem × modais de consulta (story 179).
 *
 * O que se prova aqui é a regressão que protege o censo: abrir a ficha ou a
 * foto de um filho **não** mexe nas confirmações já marcadas (`confirmedIds` é
 * estado local da página) e cada handler leva o filho certo.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ResidentStatus, Role } from '@fonte/types';

let mockRole = Role.COORDINATOR;

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});
jest.mock('@/lib/auth', () => ({ useAuth: () => ({ staff: { houseId: 'h1', user: { role: mockRole } } }) }));
jest.mock('@/lib/offline/fieldSubmit', () => ({ useFieldSubmit: () => jest.fn() }));

const mockResidents = [
  { id: 'r1', name: 'João', status: ResidentStatus.ACTIVE, entryDate: '2026-01-05' },
  {
    id: 'r2',
    name: 'Maria',
    status: ResidentStatus.ACTIVE,
    entryDate: '2026-02-10',
    photoThumbUrl: 'https://x/t.jpg',
    photoUrl: 'https://x/full.jpg',
  },
];
jest.mock('../hooks/useCensus', () => ({
  useActiveResidentsByHouse: () => ({
    data: mockResidents,
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  }),
  useConcludeCensus: () => ({ isPending: false }),
}));

jest.mock('../components/AddResidentModal', () => ({ AddResidentModal: () => null }));
jest.mock('@/features/residents/components/RemoveResidentModal', () => ({
  RemoveResidentModal: () => null,
}));
jest.mock('../components/ConcludeCensusModal', () => ({ ConcludeCensusModal: () => null }));
jest.mock('../components/ResidentDetailModal', () => {
  const { Text } = require('react-native');
  return {
    ResidentDetailModal: ({ visible, resident }: { visible: boolean; resident: { name: string } | null }) =>
      visible ? <Text>{`detalhes:${resident?.name}`}</Text> : null,
  };
});
jest.mock('@/features/residents/components/ResidentPhotoViewer', () => {
  const { Text } = require('react-native');
  return {
    ResidentPhotoViewer: ({ visible, name }: { visible: boolean; name: string }) =>
      visible ? <Text>{`foto:${name}`}</Text> : null,
  };
});

import { CensusPage } from './CensusPage';

describe('CensusPage — modais de consulta', () => {
  beforeEach(() => { mockRole = Role.COORDINATOR; });

  it('servo confirma presença, mas não pode remover filho pela contagem', () => {
    mockRole = Role.SERVANT;
    render(<CensusPage />);
    expect(screen.queryByLabelText('Remover João')).toBeNull();
    expect(screen.getByLabelText('Confirmar João')).toBeTruthy();
  });

  it.each([Role.ADMIN, Role.COORDINATOR])('%s pode remover filho ativo', (role) => {
    mockRole = role;
    render(<CensusPage />);
    expect(screen.getByLabelText('Remover João')).toBeTruthy();
  });

  it('abrir e fechar os detalhes não altera as confirmações', () => {
    render(<CensusPage />);
    expect(screen.getByText('0/2 confirmados')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Confirmar João'));
    expect(screen.getByText('1/2 confirmados')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Detalhes de João'));
    expect(screen.getByText('detalhes:João')).toBeTruthy();
    expect(screen.getByText('1/2 confirmados')).toBeTruthy();
  });

  it('cada linha abre os detalhes do seu próprio filho', () => {
    render(<CensusPage />);
    fireEvent.press(screen.getByLabelText('Detalhes de Maria'));
    expect(screen.getByText('detalhes:Maria')).toBeTruthy();
    expect(screen.queryByText('detalhes:João')).toBeNull();
  });

  it('toque na foto abre o visualizador do filho da linha', () => {
    render(<CensusPage />);
    fireEvent.press(screen.getByLabelText('Ver foto de Maria'));
    expect(screen.getByText('foto:Maria')).toBeTruthy();
    expect(screen.queryByText('detalhes:Maria')).toBeNull();
  });
});
