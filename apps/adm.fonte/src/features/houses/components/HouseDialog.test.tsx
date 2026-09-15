import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import type { House } from '@fonte/api-client';

const createMutate = vi.fn();
const updateMutate = vi.fn();
let createState = { isPending: false };
let updateState = { isPending: false };
const houseByIdArgs = vi.fn();
// O schema exige uuid no titular (constants.ts): ids de mentira como 'c1' seriam
// barrados pelo zod antes do submit e o teste mentiria sobre o payload.
const COORD_UM = '11111111-1111-4111-8111-111111111111';
const COORD_DOIS = '22222222-2222-4222-8222-222222222222';
const COORDINATORS = [
  { id: COORD_UM, name: 'Coord Um', whatsapp: null, photoUrl: null },
  { id: COORD_DOIS, name: 'Coord Dois', whatsapp: null, photoUrl: null },
];
let detail: unknown = { id: 'h1', coordinators: COORDINATORS };

vi.mock('../hooks/useHouses', () => ({
  useCreateHouse: () => ({ mutate: createMutate, ...createState }),
  useUpdateHouse: () => ({ mutate: updateMutate, ...updateState }),
  useHouseById: (...args: unknown[]) => {
    houseByIdArgs(...args);
    return { data: detail };
  },
}));

import { HouseDialog } from './HouseDialog';

function makeHouse(overrides: Partial<House> = {}): House {
  return {
    id: 'h1',
    name: 'Casa Belém',
    generalCapacity: 10,
    staffCapacity: 2,
    address: 'Rua A',
    city: 'Goiânia',
    state: 'GO',
    coordinatorId: '',
    phone: '6233334444',
    isMotherHouse: false,
    ...overrides,
  } as House;
}

beforeEach(() => {
  vi.clearAllMocks();
  createState = { isPending: false };
  updateState = { isPending: false };
  detail = { id: 'h1', coordinators: COORDINATORS };
});
afterEach(() => cleanup());

describe('HouseDialog', () => {
  it('título "Nova Casa" no modo criação', () => {
    render(<HouseDialog open house={null} onClose={vi.fn()} />);
    expect(screen.getByText('Nova Casa')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Criar' })).toBeInTheDocument();
  });

  it('título "Editar Casa" e nome preenchido no modo edição', () => {
    render(<HouseDialog open house={makeHouse()} onClose={vi.fn()} />);
    expect(screen.getByText('Editar Casa')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Casa Belém')).toBeInTheDocument();
  });

  it('cria casa com payload sanitizado e fecha no sucesso', async () => {
    const onClose = vi.fn();
    createMutate.mockImplementation((_d, opts) => opts.onSuccess());
    render(<HouseDialog open house={null} onClose={onClose} />);
    fireEvent.change(screen.getByLabelText(/Nome/i), { target: { value: 'Casa Nova' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    await waitFor(() => expect(createMutate).toHaveBeenCalled());
    const payload = createMutate.mock.calls[0][0];
    expect(payload.name).toBe('Casa Nova');
    // capacidades vazias viram null pela sanitização
    expect(payload.generalCapacity).toBeNull();
    expect(onClose).toHaveBeenCalled();
  });

  it('edita casa chamando updateMutation', async () => {
    const onClose = vi.fn();
    updateMutate.mockImplementation((_d, opts) => opts.onSuccess());
    render(<HouseDialog open house={makeHouse()} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(updateMutate).toHaveBeenCalled());
    expect(createMutate).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('cancelar dispara onClose', () => {
    const onClose = vi.fn();
    render(<HouseDialog open house={null} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('botão desabilitado enquanto pending', () => {
    createState = { isPending: true };
    render(<HouseDialog open house={null} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Criar' })).toBeDisabled();
  });

  // ─── Coordenador titular (story 194) ─────────────────────────────────────

  it('em edição oferece só os coordenadores da casa como titular', () => {
    render(<HouseDialog open house={makeHouse()} onClose={vi.fn()} />);

    const select = screen.getByLabelText('Coordenador titular') as HTMLSelectElement;
    expect([...select.options].map((o) => o.textContent)).toEqual([
      'Sem titular',
      'Coord Um',
      'Coord Dois',
    ]);
  });

  it('busca o detalhe só quando o dialog de edição está aberto', () => {
    render(<HouseDialog open={false} house={makeHouse()} onClose={vi.fn()} />);
    expect(houseByIdArgs).toHaveBeenLastCalledWith('h1', { enabled: false });

    cleanup();
    render(<HouseDialog open house={null} onClose={vi.fn()} />);
    expect(houseByIdArgs).toHaveBeenLastCalledWith('', { enabled: false });
  });

  it('opção vazia é enviada como coordinatorId null, nunca string vazia', async () => {
    const onClose = vi.fn();
    updateMutate.mockImplementation((_d, opts) => opts.onSuccess());
    render(<HouseDialog open house={makeHouse({ coordinatorId: COORD_UM })} onClose={onClose} />);

    fireEvent.change(screen.getByLabelText('Coordenador titular'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(updateMutate).toHaveBeenCalled());
    expect(updateMutate.mock.calls[0][0].coordinatorId).toBeNull();
  });

  it('envia o titular escolhido', async () => {
    updateMutate.mockImplementation((_d, opts) => opts.onSuccess());
    render(<HouseDialog open house={makeHouse()} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Coordenador titular'), { target: { value: COORD_DOIS } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(updateMutate).toHaveBeenCalled());
    expect(updateMutate.mock.calls[0][0].coordinatorId).toBe(COORD_DOIS);
  });

  // O 400 do backend (titular inelegível) chega como a frase do backend, via
  // getErrorMessage — nunca como erro cru do axios.
  it('mostra a mensagem do backend quando o titular é recusado', async () => {
    updateMutate.mockImplementation((_d, opts) =>
      opts.onError({
        response: {
          data: { message: 'O coordenador titular precisa ser um coordenador lotado nesta casa.' },
        },
      }),
    );
    const onClose = vi.fn();
    render(<HouseDialog open house={makeHouse()} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(
      await screen.findByText('O coordenador titular precisa ser um coordenador lotado nesta casa.'),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  // Enquanto o detalhe não resolve, vale o que a própria casa já trouxe — o
  // select não pisca vazio.
  it('cai na lista da casa recebida quando o detalhe ainda não chegou', () => {
    detail = undefined;
    render(
      <HouseDialog open house={makeHouse({ coordinators: COORDINATORS })} onClose={vi.fn()} />,
    );

    const select = screen.getByLabelText('Coordenador titular') as HTMLSelectElement;
    expect([...select.options].map((o) => o.textContent)).toContain('Coord Um');
  });

  it('casa da listagem, sem detalhe e sem lista, não quebra o select', () => {
    detail = undefined;
    render(<HouseDialog open house={makeHouse()} onClose={vi.fn()} />);

    const select = screen.getByLabelText('Coordenador titular') as HTMLSelectElement;
    expect(select.options).toHaveLength(1);
  });

  it('na criação não mostra o campo de titular', () => {
    render(<HouseDialog open house={null} onClose={vi.fn()} />);
    expect(screen.queryByLabelText('Coordenador titular')).not.toBeInTheDocument();
  });
});
