import { waitFor } from '@testing-library/react-native';

jest.mock('@/lib/api', () => ({
  api: {
    residents: {
      list: jest.fn(),
      listByHouse: jest.fn(),
      getById: jest.fn(),
      resetPassword: jest.fn(),
      getAttachments: jest.fn(),
      getFollowUps: jest.fn(),
      createFollowUp: jest.fn(),
    },
    relatives: {
      listByResident: jest.fn(),
    },
    consents: {
      status: jest.fn(),
      grant: jest.fn(),
      revoke: jest.fn(),
    },
    houses: {
      listMinistries: jest.fn(),
    },
  },
}));

import { api } from '@/lib/api';
import { renderHookWithClient } from '@/lib/test/utils';
import {
  useAllResidents,
  useResidentsByHouse,
  useResidentCountByHouse,
  useResidentById,
  useResidentRelatives,
  useResetResidentPassword,
  useResidentAttachments,
} from './useResidents';
import {
  useResidentFollowUps,
  useCreateFollowUp,
} from './useResidentFollowUps';
import {
  useResidentConsents,
  useToggleResidentConsent,
} from './useResidentConsents';
import { useHouseMinistries } from './useHouseMinistries';

const m = api as unknown as {
  residents: Record<string, jest.Mock>;
  relatives: Record<string, jest.Mock>;
  consents: Record<string, jest.Mock>;
  houses: Record<string, jest.Mock>;
};

beforeEach(() => jest.clearAllMocks());

describe('useResidents — queries de listagem', () => {
  it('useAllResidents lista todos', async () => {
    m.residents.list.mockResolvedValue([{ id: 'r1' }]);
    const { result } = renderHookWithClient(() => useAllResidents());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.residents.list).toHaveBeenCalledTimes(1);
  });

  it('useResidentsByHouse busca por casa quando houseId presente', async () => {
    m.residents.listByHouse.mockResolvedValue([{ id: 'r1' }]);
    const { result } = renderHookWithClient(() => useResidentsByHouse('h1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.residents.listByHouse).toHaveBeenCalledWith('h1');
  });

  it('useResidentsByHouse não dispara sem houseId', () => {
    renderHookWithClient(() => useResidentsByHouse(null));
    expect(m.residents.listByHouse).not.toHaveBeenCalled();
  });

  it('useResidentCountByHouse usa listByHouse com a casa', async () => {
    m.residents.listByHouse.mockResolvedValue([{ id: 'r1' }, { id: 'r2' }]);
    const { result } = renderHookWithClient(() => useResidentCountByHouse('h1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.residents.listByHouse).toHaveBeenCalledWith('h1');
    expect(result.current.data).toHaveLength(2);
  });

  it('useResidentById busca o detalhe', async () => {
    m.residents.getById.mockResolvedValue({ id: 'r1' });
    const { result } = renderHookWithClient(() => useResidentById('r1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.residents.getById).toHaveBeenCalledWith('r1');
  });

  it('useResidentById não dispara sem id', () => {
    renderHookWithClient(() => useResidentById(undefined));
    expect(m.residents.getById).not.toHaveBeenCalled();
  });
});

describe('useResidents — relatives, attachments, reset', () => {
  it('useResidentRelatives respeita enabled=false', () => {
    renderHookWithClient(() => useResidentRelatives('r1', { enabled: false }));
    expect(m.relatives.listByResident).not.toHaveBeenCalled();
  });

  it('useResidentRelatives lista quando habilitado', async () => {
    m.relatives.listByResident.mockResolvedValue([{ id: 'rel1' }]);
    const { result } = renderHookWithClient(() => useResidentRelatives('r1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.relatives.listByResident).toHaveBeenCalledWith('r1');
  });

  it('useResidentAttachments lista anexos', async () => {
    m.residents.getAttachments.mockResolvedValue([{ id: 'a1' }]);
    const { result } = renderHookWithClient(() => useResidentAttachments('r1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.residents.getAttachments).toHaveBeenCalledWith('r1');
  });

  it('useResidentAttachments respeita enabled=false', () => {
    renderHookWithClient(() => useResidentAttachments('r1', { enabled: false }));
    expect(m.residents.getAttachments).not.toHaveBeenCalled();
  });

  it('useResetResidentPassword envia { password }', async () => {
    m.residents.resetPassword.mockResolvedValue({ ok: true });
    const { result } = renderHookWithClient(() => useResetResidentPassword('r1'));
    result.current.mutate('senha-nova-123');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.residents.resetPassword).toHaveBeenCalledWith('r1', { password: 'senha-nova-123' });
  });
});

describe('useResidentFollowUps', () => {
  it('lista acompanhamentos', async () => {
    m.residents.getFollowUps.mockResolvedValue([{ id: 'f1' }]);
    const { result } = renderHookWithClient(() => useResidentFollowUps('r1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.residents.getFollowUps).toHaveBeenCalledWith('r1');
  });

  it('respeita enabled=false', () => {
    renderHookWithClient(() => useResidentFollowUps('r1', { enabled: false }));
    expect(m.residents.getFollowUps).not.toHaveBeenCalled();
  });

  it('useCreateFollowUp envia o payload', async () => {
    m.residents.createFollowUp.mockResolvedValue({ id: 'f1' });
    const { result } = renderHookWithClient(() => useCreateFollowUp('r1'));
    result.current.mutate({ type: 'NOTE', note: 'obs' } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.residents.createFollowUp).toHaveBeenCalledWith('r1', { type: 'NOTE', note: 'obs' });
  });
});

describe('useResidentConsents (LGPD)', () => {
  it('busca status de consentimento do residente', async () => {
    m.consents.status.mockResolvedValue([{ purpose: 'IMAGE_USE', granted: true }]);
    const { result } = renderHookWithClient(() => useResidentConsents('r1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.consents.status).toHaveBeenCalledWith('RESIDENT', 'r1');
  });

  it('toggle revoga quando já concedido', async () => {
    m.consents.revoke.mockResolvedValue({ ok: true });
    const { result } = renderHookWithClient(() => useToggleResidentConsent('r1'));
    result.current.mutate({ purpose: 'IMAGE_USE' as never, granted: true });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.consents.revoke).toHaveBeenCalledWith({
      subjectType: 'RESIDENT',
      subjectId: 'r1',
      purpose: 'IMAGE_USE',
    });
    expect(m.consents.grant).not.toHaveBeenCalled();
  });

  it('toggle concede quando ainda não concedido (termVersion 1.0)', async () => {
    m.consents.grant.mockResolvedValue({ ok: true });
    const { result } = renderHookWithClient(() => useToggleResidentConsent('r1'));
    result.current.mutate({ purpose: 'IMAGE_USE' as never, granted: false });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.consents.grant).toHaveBeenCalledWith({
      subjectType: 'RESIDENT',
      subjectId: 'r1',
      purpose: 'IMAGE_USE',
      termVersion: '1.0',
    });
  });
});

describe('useHouseMinistries', () => {
  it('lista ministérios da casa', async () => {
    m.houses.listMinistries.mockResolvedValue([{ id: 'min1' }]);
    const { result } = renderHookWithClient(() => useHouseMinistries('h1'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(m.houses.listMinistries).toHaveBeenCalledWith('h1');
  });

  it('respeita enabled=false', () => {
    renderHookWithClient(() => useHouseMinistries('h1', { enabled: false }));
    expect(m.houses.listMinistries).not.toHaveBeenCalled();
  });
});
